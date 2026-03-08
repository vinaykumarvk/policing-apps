import { query } from "../db";
import { getParser, getParserConfig } from "../parsers/parser-registry";
import type { ParserInput, ParsedArtifact } from "../parsers/types";
import * as crypto from "crypto";

export interface ImportExecutionResult {
  success: boolean;
  jobId: string;
  artifactsCreated: number;
  entitiesCreated: number;
  warnings: string[];
  error?: string;
}

/**
 * Validate checksum of import data.
 */
function computeChecksum(data: Buffer): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

/**
 * Check idempotency key to prevent duplicate processing.
 */
async function checkIdempotency(idempotencyKey: string): Promise<boolean> {
  const result = await query(
    `SELECT job_id, state_id FROM import_job WHERE idempotency_key = $1`,
    [idempotencyKey],
  );
  return result.rows.length > 0;
}

/**
 * Execute a forensic import job:
 * 1. Validate checksum against expected value
 * 2. Check idempotency key for duplicates
 * 3. Run appropriate parser
 * 4. Insert artifacts and entities
 * 5. Update import job state
 */
export async function executeImport(
  jobId: string,
  data: Buffer,
  filename: string,
  parserType: string,
  caseId: string,
  evidenceId: string | undefined,
  idempotencyKey: string | undefined,
  expectedChecksum: string | undefined,
): Promise<ImportExecutionResult> {
  const warnings: string[] = [];
  let artifactsCreated = 0;
  let entitiesCreated = 0;

  try {
    // Update job to IN_PROGRESS
    await query(`UPDATE import_job SET state_id = 'IN_PROGRESS', started_at = NOW() WHERE import_job_id = $1`, [jobId]);

    // 1. Compute and validate checksum
    const actualChecksum = computeChecksum(data);
    if (expectedChecksum && actualChecksum !== expectedChecksum) {
      // Quarantine: checksum mismatch
      await query(
        `UPDATE import_job SET state_id = 'FAILED', quarantine_reason = $1, checksum_sha256 = $2, completed_at = NOW()
         WHERE import_job_id = $3`,
        [`Checksum mismatch: expected ${expectedChecksum}, got ${actualChecksum}`, actualChecksum, jobId],
      );
      return { success: false, jobId, artifactsCreated: 0, entitiesCreated: 0, warnings: [], error: "CHECKSUM_MISMATCH" };
    }

    // Store checksum
    await query(`UPDATE import_job SET checksum_sha256 = $1 WHERE import_job_id = $2`, [actualChecksum, jobId]);

    // 2. Check idempotency
    if (idempotencyKey) {
      const isDuplicate = await checkIdempotency(idempotencyKey);
      if (isDuplicate) {
        await query(
          `UPDATE import_job SET state_id = 'FAILED', quarantine_reason = 'Duplicate idempotency key', completed_at = NOW()
           WHERE import_job_id = $1`,
          [jobId],
        );
        return { success: false, jobId, artifactsCreated: 0, entitiesCreated: 0, warnings: [], error: "DUPLICATE_IMPORT" };
      }
      await query(`UPDATE import_job SET idempotency_key = $1 WHERE import_job_id = $2`, [idempotencyKey, jobId]);
    }

    // 3. Resolve parser
    const parser = await getParser(parserType);
    if (!parser) {
      await query(
        `UPDATE import_job SET state_id = 'FAILED', error_message = $1, completed_at = NOW() WHERE import_job_id = $2`,
        [`Unknown or inactive parser type: ${parserType}`, jobId],
      );
      return { success: false, jobId, artifactsCreated: 0, entitiesCreated: 0, warnings: [], error: "UNKNOWN_PARSER" };
    }

    const config = await getParserConfig(parserType);
    const input: ParserInput = { data, filename, checksum: actualChecksum, caseId, evidenceId };

    // 4. Validate input
    const isValid = await parser.validate(input);
    if (!isValid) {
      warnings.push(`Parser ${parserType} could not validate input format for ${filename}`);
    }

    // 5. Run parser
    const parseResult = await parser.parse(input, config);
    warnings.push(...parseResult.warnings);

    // 6. Insert artifacts (FR-03 AC-03/04: set parser_version and artifact_type from registry)
    const parserVersion = String(config?.version || parser.version || "unknown");
    for (const artifact of parseResult.artifacts) {
      await insertArtifact(caseId, jobId, artifact, parserVersion);
      artifactsCreated++;
    }

    // 7. Insert entities
    for (const entity of parseResult.entities) {
      await query(
        `INSERT INTO extracted_entity (case_id, entity_type, entity_value, confidence, metadata_jsonb)
         VALUES ($1, $2, $3, $4, $5)`,
        [caseId, entity.entityType, entity.entityValue, entity.confidence, JSON.stringify(entity.metadata || {})],
      );
      entitiesCreated++;
    }

    // 8. Insert relationships
    for (const rel of parseResult.relationships) {
      const sourceResult = await query(
        `SELECT entity_id FROM extracted_entity WHERE entity_value = $1 AND case_id = $2 LIMIT 1`,
        [rel.sourceEntityValue, caseId],
      );
      const targetResult = await query(
        `SELECT entity_id FROM extracted_entity WHERE entity_value = $1 AND case_id = $2 LIMIT 1`,
        [rel.targetEntityValue, caseId],
      );
      if (sourceResult.rows.length > 0 && targetResult.rows.length > 0) {
        await query(
          `INSERT INTO relationship (case_id, source_entity_id, target_entity_id, relationship_type, weight)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT DO NOTHING`,
          [caseId, sourceResult.rows[0].entity_id, targetResult.rows[0].entity_id, rel.relationshipType, rel.weight || 1.0],
        );
      }
    }

    // 9. Complete job
    const finalState = warnings.length > 0 && artifactsCreated === 0 ? "FAILED" : "COMPLETED";
    await query(
      `UPDATE import_job SET state_id = $1, progress_pct = 100, completed_at = NOW(), warnings = $2
       WHERE import_job_id = $3`,
      [finalState, JSON.stringify(warnings), jobId],
    );

    return { success: true, jobId, artifactsCreated, entitiesCreated, warnings };
  } catch (err) {
    await query(
      `UPDATE import_job SET state_id = 'FAILED', error_message = $1, completed_at = NOW() WHERE import_job_id = $2`,
      [String(err), jobId],
    );
    return { success: false, jobId, artifactsCreated, entitiesCreated, warnings, error: String(err) };
  }
}

async function insertArtifact(caseId: string, jobId: string, artifact: ParsedArtifact, parserVersion?: string): Promise<string> {
  const result = await query(
    `INSERT INTO artifact (case_id, import_job_id, artifact_type, source_path, content_preview, metadata_jsonb, hash_sha256, parser_version)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING artifact_id`,
    [caseId, jobId, artifact.artifactType, artifact.sourcePath, artifact.contentPreview,
     JSON.stringify(artifact.metadata), artifact.hashSha256 || null, parserVersion || null],
  );
  return result.rows[0].artifact_id;
}
