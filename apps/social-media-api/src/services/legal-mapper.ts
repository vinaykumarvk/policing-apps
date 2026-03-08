import { query } from "../db";
import { autoMapEntityWithRules } from "./legal-rule-evaluator";

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

  // Get all active statutes; prefer BNS over superseded IPC sections
  const statutes = await query(
    `SELECT * FROM statute_library WHERE is_active = true ORDER BY act_name, section`
  );

  // Build a set of statute_ids that have been superseded by another active statute
  const supersededIds = new Set<string>();
  for (const s of statutes.rows) {
    if (s.superseded_by) supersededIds.add(s.statute_id);
  }

  const suggestions: MappingSuggestion[] = [];

  for (const statute of statutes.rows) {
    // Skip IPC sections that have been superseded by BNS equivalents
    if (supersededIds.has(statute.statute_id)) continue;

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
  // Try rule-based mapping first
  const ruleMappings = await autoMapEntityWithRules(entityType, entityId);
  if (ruleMappings.length > 0) {
    return ruleMappings;
  }

  // Fallback to keyword matching
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
        `INSERT INTO legal_mapping (entity_type, entity_id, statute_id, mapping_source, confidence,
           confidence_score, reviewer_status)
         VALUES ($1, $2, $3, 'AUTO', $4, $4, 'PENDING') RETURNING *`,
        [entityType, entityId, suggestion.statuteId, suggestion.confidence]
      );
      mappings.push({ ...result.rows[0], act_name: suggestion.actName, section: suggestion.section });
    }
  }

  return mappings;
}

export async function getMappings(entityType: string, entityId: string): Promise<DbRow[]> {
  const result = await query(
    `SELECT lm.*, sl.act_name, sl.section, sl.description, sl.penalty_summary,
            r.rule_code, r.law_name AS rule_law_name
     FROM legal_mapping lm
     JOIN statute_library sl ON sl.statute_id = lm.statute_id
     LEFT JOIN legal_mapping_rule r ON r.rule_id = lm.rule_id
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
    `INSERT INTO legal_mapping (entity_type, entity_id, statute_id, mapping_source, confidence,
       confidence_score, confirmed, confirmed_by, confirmed_at, reviewer_status)
     VALUES ($1, $2, $3, 'MANUAL', 100, 100, true, $4, now(), 'APPROVED') RETURNING *`,
    [entityType, entityId, statuteId, userId]
  );
  return result.rows[0];
}

export async function getStatutes(searchTerm?: string): Promise<DbRow[]> {
  const baseQuery = `SELECT s.*,
       sup.act_name AS superseded_act, sup.section AS superseded_section
     FROM statute_library s
     LEFT JOIN statute_library sup ON sup.superseded_by = s.statute_id
     WHERE s.is_active = true`;

  if (searchTerm) {
    const result = await query(
      `${baseQuery}
       AND (s.act_name ILIKE '%' || $1 || '%' OR s.section ILIKE '%' || $1 || '%' OR s.description ILIKE '%' || $1 || '%')
       ORDER BY s.act_name, s.section`,
      [searchTerm]
    );
    return result.rows;
  }
  const result = await query(`${baseQuery} ORDER BY s.act_name, s.section`);
  return result.rows;
}

export async function reviewMapping(
  mappingId: string,
  userId: string,
  decision: "APPROVED" | "REJECTED",
  reason?: string
): Promise<DbRow | null> {
  const result = await query(
    `UPDATE legal_mapping
     SET reviewer_status = $2, reviewed_by = $3, reviewed_at = NOW(),
         rationale_text = CASE WHEN $4::text IS NOT NULL THEN COALESCE(rationale_text, '') || ' | Review: ' || $4 ELSE rationale_text END
     WHERE mapping_id = $1 RETURNING *`,
    [mappingId, decision, userId, reason || null]
  );
  return result.rows[0] || null;
}

export async function getPendingMappings(limit: number, offset: number): Promise<{ rows: DbRow[]; total: number }> {
  const countRes = await query(
    `SELECT COUNT(*)::int AS total FROM legal_mapping WHERE reviewer_status = 'PENDING'`
  );
  const total = (countRes.rows[0]?.total as number) || 0;

  const result = await query(
    `SELECT lm.*, sl.act_name, sl.section, sl.description,
            r.rule_code, r.law_name AS rule_law_name
     FROM legal_mapping lm
     JOIN statute_library sl ON sl.statute_id = lm.statute_id
     LEFT JOIN legal_mapping_rule r ON r.rule_id = lm.rule_id
     WHERE lm.reviewer_status = 'PENDING'
     ORDER BY lm.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  return { rows: result.rows, total };
}
