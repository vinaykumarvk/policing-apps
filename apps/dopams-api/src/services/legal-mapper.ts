import { query } from "../db";

type DbRow = Record<string, unknown>;

interface MappingSuggestion {
  statuteId: string;
  actName: string;
  section: string;
  description: string;
  confidence: number;
  matchedKeywords: string[];
}

export async function suggestStatutes(text: string): Promise<MappingSuggestion[]> {
  const lowerText = (text || "").toLowerCase();

  // Get all active statutes
  const statutes = await query(`SELECT * FROM statute_library WHERE is_active = true`);

  const suggestions: MappingSuggestion[] = [];

  for (const statute of statutes.rows) {
    const keywords: string[] = statute.keywords || [];
    const matchedKeywords = keywords.filter(kw => lowerText.includes(kw.toLowerCase()));

    if (matchedKeywords.length > 0) {
      const confidence = Math.min(100, (matchedKeywords.length / Math.max(keywords.length, 1)) * 100);
      suggestions.push({
        statuteId: statute.statute_id,
        actName: statute.act_name,
        section: statute.section,
        description: statute.description,
        confidence: Math.round(confidence * 100) / 100,
        matchedKeywords,
      });
    }
  }

  // Sort by confidence descending
  suggestions.sort((a, b) => b.confidence - a.confidence);
  return suggestions;
}

export async function autoMapEntity(entityType: string, entityId: string, text: string): Promise<DbRow[]> {
  const suggestions = await suggestStatutes(text);
  const mappings: DbRow[] = [];

  for (const suggestion of suggestions) {
    // Check if mapping already exists
    const existing = await query(
      `SELECT 1 FROM legal_mapping WHERE entity_type = $1 AND entity_id = $2 AND statute_id = $3`,
      [entityType, entityId, suggestion.statuteId]
    );

    if (existing.rows.length === 0) {
      const result = await query(
        `INSERT INTO legal_mapping (entity_type, entity_id, statute_id, mapping_source, confidence)
         VALUES ($1, $2, $3, 'AUTO', $4) RETURNING *`,
        [entityType, entityId, suggestion.statuteId, suggestion.confidence]
      );
      mappings.push({ ...result.rows[0], act_name: suggestion.actName, section: suggestion.section });
    }
  }

  return mappings;
}

export async function getMappings(entityType: string, entityId: string): Promise<DbRow[]> {
  const result = await query(
    `SELECT lm.*, sl.act_name, sl.section, sl.description, sl.penalty_summary
     FROM legal_mapping lm JOIN statute_library sl ON sl.statute_id = lm.statute_id
     WHERE lm.entity_type = $1 AND lm.entity_id = $2
     ORDER BY lm.confidence DESC`,
    [entityType, entityId]
  );
  return result.rows;
}

export async function confirmMapping(mappingId: string, userId: string): Promise<DbRow> {
  const result = await query(
    `UPDATE legal_mapping SET confirmed = true, confirmed_by = $2, confirmed_at = now()
     WHERE mapping_id = $1 RETURNING *`,
    [mappingId, userId]
  );
  return result.rows[0];
}

export async function addManualMapping(entityType: string, entityId: string, statuteId: string, userId: string): Promise<DbRow> {
  const result = await query(
    `INSERT INTO legal_mapping (entity_type, entity_id, statute_id, mapping_source, confidence, confirmed, confirmed_by, confirmed_at)
     VALUES ($1, $2, $3, 'MANUAL', 100, true, $4, now()) RETURNING *`,
    [entityType, entityId, statuteId, userId]
  );
  return result.rows[0];
}

export async function getPendingMappings(limit: number, offset: number): Promise<{ rows: DbRow[]; total: number }> {
  const result = await query(
    `SELECT lm.*, sl.act_name, sl.section, sl.description, sl.penalty_summary,
            COUNT(*) OVER() AS total_count
     FROM legal_mapping lm
     JOIN statute_library sl ON sl.statute_id = lm.statute_id
     WHERE lm.confirmed = false AND lm.review_status IS NULL
     ORDER BY lm.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count as string, 10) : 0;
  return { rows: result.rows.map(({ total_count, ...r }: any) => r), total };
}

export async function reviewMapping(
  mappingId: string,
  userId: string,
  decision: "APPROVED" | "REJECTED",
  reason?: string,
): Promise<DbRow | null> {
  if (decision === "APPROVED") {
    const result = await query(
      `UPDATE legal_mapping SET confirmed = true, confirmed_by = $2, confirmed_at = NOW(),
              review_status = 'APPROVED', review_reason = $3, reviewed_by = $2, reviewed_at = NOW()
       WHERE mapping_id = $1 RETURNING *`,
      [mappingId, userId, reason || null]
    );
    return result.rows[0] || null;
  } else {
    const result = await query(
      `UPDATE legal_mapping SET review_status = 'REJECTED', review_reason = $3,
              reviewed_by = $2, reviewed_at = NOW()
       WHERE mapping_id = $1 RETURNING *`,
      [mappingId, userId, reason || null]
    );
    return result.rows[0] || null;
  }
}

export async function getStatutes(searchTerm?: string): Promise<DbRow[]> {
  if (searchTerm) {
    const result = await query(
      `SELECT * FROM statute_library WHERE is_active = true
       AND (act_name ILIKE '%' || $1 || '%' OR section ILIKE '%' || $1 || '%' OR description ILIKE '%' || $1 || '%')
       ORDER BY act_name, section`,
      [searchTerm]
    );
    return result.rows;
  }
  const result = await query(`SELECT * FROM statute_library WHERE is_active = true ORDER BY act_name, section`);
  return result.rows;
}
