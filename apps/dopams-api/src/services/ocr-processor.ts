import { query } from "../db";

type DbRow = Record<string, unknown>;

export interface OcrJobOptions {
  language?: string;
  confidenceThreshold?: number;
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

  const result = await query(
    `INSERT INTO ocr_job (evidence_id, status, language, confidence_threshold, created_by)
     VALUES ($1, 'PENDING', $2, $3, $4)
     RETURNING job_id`,
    [evidenceId, language, confidenceThreshold, createdBy],
  );
  const jobId = result.rows[0].job_id;

  // Process asynchronously — fire-and-forget
  processOcrJob(jobId, confidenceThreshold).catch((err) =>
    console.error("OCR processing error:", err),
  );

  return { jobId };
}

async function processOcrJob(jobId: string, confidenceThreshold: number): Promise<void> {
  await query(
    `UPDATE ocr_job SET status = 'PROCESSING', updated_at = now() WHERE job_id = $1`,
    [jobId],
  );

  try {
    // Stub: In production, integrate tesseract.js or an external OCR service.
    // For now, mark as completed with a placeholder result.
    const stubConfidence = 0; // Placeholder; real OCR engine returns actual confidence

    // FR-03: Confidence threshold routing — low confidence routes to NEEDS_REVIEW
    const reviewStatus = stubConfidence < confidenceThreshold ? "NEEDS_REVIEW" : "COMPLETED";
    const status = reviewStatus === "NEEDS_REVIEW" ? "NEEDS_REVIEW" : "COMPLETED";

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
