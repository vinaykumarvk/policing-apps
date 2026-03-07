import { createHash } from "node:crypto";
import { query } from "../db";
import type { NormalizedRecord, IngestionResult } from "./types";

/**
 * Core ingestion pipeline for DOPAMS.
 * Normalizes incoming records, deduplicates, upserts into source_document table,
 * and updates ingestion job status.
 */
export async function ingestRecords(
  records: NormalizedRecord[],
  jobId: string,
  connectorName: string,
): Promise<IngestionResult> {
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const record of records) {
    try {
      // Compute SHA-256 checksum of the content
      const contentStr = JSON.stringify({ title: record.title, content: record.content, metadata: record.metadata });
      const checksum = createHash("sha256").update(contentStr).digest("hex");

      // Check for existing record by external_id + source
      const existing = await query(
        `SELECT document_id, checksum_sha256 FROM source_document WHERE external_id = $1 AND source_type = $2`,
        [record.externalId, record.sourceType],
      );

      // Checksum-based quarantine: if existing record has different checksum AND same external_id, quarantine
      if (existing.rows.length > 0 && existing.rows[0].checksum_sha256 && existing.rows[0].checksum_sha256 !== checksum) {
        // Content changed — update and flag for review
        await query(
          `UPDATE source_document SET title = $1, content = $2, metadata_jsonb = $3, checksum_sha256 = $4,
                  quarantine_status = 'FLAGGED', quarantine_reason = 'Checksum mismatch on re-ingest', updated_at = NOW()
           WHERE external_id = $5 AND source_type = $6`,
          [record.title, record.content, JSON.stringify(record.metadata), checksum, record.externalId, record.sourceType],
        );
        updated++;
      } else if (existing.rows.length > 0) {
        // Update existing record with checksum
        await query(
          `UPDATE source_document SET title = $1, content = $2, metadata_jsonb = $3, checksum_sha256 = $4, updated_at = NOW()
           WHERE external_id = $5 AND source_type = $6`,
          [record.title, record.content, JSON.stringify(record.metadata), checksum, record.externalId, record.sourceType],
        );
        updated++;
      } else {
        // Insert new record with checksum
        await query(
          `INSERT INTO source_document (external_id, source_type, document_type, title, content, metadata_jsonb, ingestion_job_id, connector_name, checksum_sha256)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (external_id, source_type) DO UPDATE SET title = EXCLUDED.title, content = EXCLUDED.content, checksum_sha256 = EXCLUDED.checksum_sha256, updated_at = NOW()`,
          [record.externalId, record.sourceType, record.documentType, record.title, record.content,
           JSON.stringify(record.metadata), jobId, connectorName, checksum],
        );
        inserted++;
      }
    } catch (err) {
      errors++;
      // Log but continue processing remaining records
      console.error(`[ingestion] Error processing record ${record.externalId}:`, err);
    }
  }

  // Update job progress
  await query(
    `UPDATE ingestion_job SET processed_records = processed_records + $1, failed_records = failed_records + $2,
      state_id = CASE WHEN $2 > 0 AND $1 = 0 THEN 'FAILED' WHEN $2 > 0 THEN 'PARTIAL' ELSE state_id END
     WHERE job_id = $3`,
    [inserted + updated + skipped, errors, jobId],
  );

  return { inserted, updated, skipped, errors, jobId };
}

/**
 * Create a new ingestion job and return its ID.
 */
export async function createIngestionJob(
  connectorId: string,
  jobType: string,
  userId: string,
  totalRecords?: number,
): Promise<string> {
  const result = await query(
    `INSERT INTO ingestion_job (connector_id, job_type, total_records, created_by, started_at)
     VALUES ($1, $2, $3, $4, NOW())
     RETURNING job_id`,
    [connectorId, jobType, totalRecords || 0, userId],
  );
  return result.rows[0].job_id;
}

/**
 * Mark an ingestion job as complete.
 */
export async function completeIngestionJob(jobId: string, stateId: "COMPLETED" | "FAILED" | "PARTIAL"): Promise<void> {
  await query(
    `UPDATE ingestion_job SET state_id = $1, completed_at = NOW() WHERE job_id = $2`,
    [stateId, jobId],
  );
}
