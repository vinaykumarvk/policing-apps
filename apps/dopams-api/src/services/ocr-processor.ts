import { query } from "../db";

type DbRow = Record<string, unknown>;

export interface OcrJobOptions {
  language?: string;
  confidenceThreshold?: number;
  /** Lower bound for MANUAL_REVIEW tier. Defaults to confidenceThreshold * 0.5 */
  lowThreshold?: number;
}

/**
 * Submit a new OCR job for a document / evidence item.
 * FR-03: Accepts language (en/hi/te) and confidence threshold.
 * Processing runs asynchronously after the row is inserted.
 */
export async function submitOcrJob(
  evidenceId: string,
  createdBy: string,
  options: OcrJobOptions = {},
): Promise<{ jobId: string }> {
  const language = options.language || "en";
  const confidenceThreshold = options.confidenceThreshold ?? 0.7;
  const lowThreshold = options.lowThreshold ?? confidenceThreshold * 0.5;

  const result = await query(
    `INSERT INTO ocr_job (evidence_id, status, language, confidence_threshold, created_by)
     VALUES ($1, 'PENDING', $2, $3, $4)
     RETURNING job_id`,
    [evidenceId, language, confidenceThreshold, createdBy],
  );
  const jobId = result.rows[0].job_id;

  // Process asynchronously — fire-and-forget
  processOcrJob(jobId, confidenceThreshold, lowThreshold).catch((err) =>
    console.error("OCR processing error:", err),
  );

  return { jobId };
}

/**
 * FR-03 AC-03/05: Three-tier OCR confidence routing
 * - confidence >= highThreshold → COMPLETED (auto-accepted)
 * - confidence >= lowThreshold → MANUAL_REVIEW (human verification needed)
 * - confidence < lowThreshold → FAILED (too unreliable)
 */
async function processOcrJob(jobId: string, highThreshold: number, lowThreshold: number): Promise<void> {
  await query(
    `UPDATE ocr_job SET status = 'PROCESSING', updated_at = now() WHERE job_id = $1`,
    [jobId],
  );

  try {
    // Stub: In production, integrate tesseract.js or an external OCR service.
    const stubConfidence = 0; // Placeholder; real OCR engine returns actual confidence

    // FR-03 AC-03: Three-tier confidence routing
    let status: string;
    let reviewStatus: string;
    if (stubConfidence >= highThreshold) {
      status = "COMPLETED";
      reviewStatus = "COMPLETED";
    } else if (stubConfidence >= lowThreshold) {
      status = "NEEDS_REVIEW";
      reviewStatus = "MANUAL_REVIEW";
    } else {
      status = "FAILED";
      reviewStatus = "FAILED";
    }

    await query(
      `UPDATE ocr_job
       SET status = $2,
           result_text = '[OCR processing placeholder - integrate tesseract.js]',
           confidence = $3,
           review_status = $4,
           updated_at = now()
       WHERE job_id = $1`,
      [jobId, status, stubConfidence, reviewStatus],
    );

    // FR-03 AC-05: Create versioned assertion for the OCR result
    await query(
      `INSERT INTO ocr_assertion (evidence_id, job_id, assertion_text, confidence, status, assertion_version)
       SELECT evidence_id, $1, $3, $4, $5,
              COALESCE((SELECT MAX(assertion_version) FROM ocr_assertion oa WHERE oa.evidence_id = oj.evidence_id), 0) + 1
       FROM ocr_job oj WHERE oj.job_id = $1`,
      [jobId, status, "[OCR assertion placeholder]", stubConfidence, reviewStatus],
    );
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await query(
      `UPDATE ocr_job
       SET status = 'FAILED',
           error_message = $2,
           updated_at = now()
       WHERE job_id = $1`,
      [jobId, errMsg || "Unknown error"],
    );
  }
}

/** Retrieve a single OCR job by its ID. */
export async function getOcrJob(jobId: string): Promise<DbRow | null> {
  const result = await query(
    `SELECT * FROM ocr_job WHERE job_id = $1`,
    [jobId],
  );
  return result.rows[0] || null;
}

/** Retrieve all OCR jobs associated with a given evidence / document ID. */
export async function getOcrJobsByEvidence(evidenceId: string): Promise<DbRow[]> {
  const result = await query(
    `SELECT * FROM ocr_job WHERE evidence_id = $1 ORDER BY created_at DESC`,
    [evidenceId],
  );
  return result.rows;
}
