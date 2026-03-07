import { query } from "../db";

export interface DerivedArtifactInput {
  caseId: string;
  sourceArtifactId: string;
  artifactType: string;
  derivationMethod: string;
  contentPreview: string;
  metadata?: Record<string, unknown>;
  hashSha256?: string;
  parserVersion?: string;
  sourceTool?: string;
}

/**
 * Create a derived artifact linked to a source artifact.
 * Used for OCR output, translated text, extracted entities, etc.
 */
export async function createDerivedArtifact(input: DerivedArtifactInput): Promise<Record<string, unknown>> {
  // Verify source artifact exists
  const source = await query(
    `SELECT artifact_id, case_id FROM artifact WHERE artifact_id = $1`,
    [input.sourceArtifactId],
  );
  if (source.rows.length === 0) {
    throw new Error(`Source artifact ${input.sourceArtifactId} not found`);
  }

  const result = await query(
    `INSERT INTO artifact (case_id, artifact_type, content_preview, metadata_jsonb,
      is_derived, derived_from_id, derivation_method, hash_sha256, source_path,
      parser_version, source_tool)
     VALUES ($1, $2, $3, $4, TRUE, $5, $6, $7, $8, $9, $10)
     RETURNING artifact_id, case_id, artifact_type, is_derived, derived_from_id, derivation_method,
              parser_version, source_tool, created_at`,
    [input.caseId, input.artifactType, input.contentPreview,
     JSON.stringify(input.metadata || {}), input.sourceArtifactId,
     input.derivationMethod, input.hashSha256 || null,
     `derived/${input.derivationMethod}/${input.sourceArtifactId}`,
     input.parserVersion || null, input.sourceTool || null],
  );

  return result.rows[0];
}

/**
 * List derived artifacts for a source artifact.
 */
export async function getDerivedArtifacts(sourceArtifactId: string): Promise<Record<string, unknown>[]> {
  const result = await query(
    `SELECT artifact_id, artifact_type, content_preview, derivation_method, hash_sha256, created_at
     FROM artifact WHERE derived_from_id = $1 ORDER BY created_at DESC`,
    [sourceArtifactId],
  );
  return result.rows;
}
