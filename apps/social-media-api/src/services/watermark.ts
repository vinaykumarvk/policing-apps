import { query } from "../db";
import * as crypto from "crypto";

/**
 * Generate a unique watermark for a document/export.
 * The watermark includes user identity, timestamp, and entity reference.
 */
export function generateWatermark(
  userId: string,
  entityType: string,
  entityId: string,
  purpose?: string,
): string {
  const timestamp = new Date().toISOString();
  const hash = crypto.createHash("sha256")
    .update(`${userId}:${entityType}:${entityId}:${timestamp}`)
    .digest("hex")
    .slice(0, 12);
  return `WM-${hash.toUpperCase()}-${timestamp.slice(0, 10)}`;
}

/**
 * Generate watermark and log it for tracking.
 */
export async function generateAndLogWatermark(
  userId: string,
  entityType: string,
  entityId: string,
  purpose?: string,
): Promise<string> {
  const watermarkText = generateWatermark(userId, entityType, entityId, purpose);

  await query(
    `INSERT INTO watermark_log (entity_type, entity_id, watermark_text, generated_by, purpose)
     VALUES ($1, $2, $3, $4, $5)`,
    [entityType, entityId, watermarkText, userId, purpose || null],
  );

  return watermarkText;
}

/**
 * Verify a watermark exists in the log.
 */
export async function verifyWatermark(watermarkText: string): Promise<Record<string, unknown> | null> {
  const result = await query(
    `SELECT w.watermark_id, w.entity_type, w.entity_id, w.watermark_text, w.purpose,
            w.exported_at, u.full_name AS generated_by_name
     FROM watermark_log w
     LEFT JOIN user_account u ON w.generated_by = u.user_id
     WHERE w.watermark_text = $1`,
    [watermarkText],
  );
  return result.rows[0] || null;
}
