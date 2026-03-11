/**
 * Entity table resolver — validated allowlist for SQL table/column resolution.
 *
 * All dynamic table/column name lookups MUST go through this module to prevent
 * SQL injection via interpolated identifiers.
 */

// ---------------------------------------------------------------------------
// Entity table map
// ---------------------------------------------------------------------------

interface EntityTableMeta {
  table: string;
  idCol: string;
  textCol: string;
}

/**
 * Maps every accepted entityType string to its safe, validated table metadata.
 *
 * Two naming conventions are supported:
 *   - Prefixed:  "dopams_alert", "dopams_lead", "dopams_case", "dopams_subject"
 *   - Short:     "alert", "lead", "case", "subject", "interrogation", "evidence"
 *   - Plural:    "alerts", "cases", "leads"  (dashboard endpoints)
 */
const ENTITY_TABLE_MAP: Record<string, EntityTableMeta> = {
  // ── Prefixed (used by classify, legal, translate, drug-classify) ──
  dopams_alert:   { table: "alert",           idCol: "alert_id",         textCol: "description" },
  dopams_lead:    { table: "lead",            idCol: "lead_id",          textCol: "details" },
  dopams_case:    { table: "dopams_case",     idCol: "case_id",          textCol: "description" },
  dopams_subject: { table: "subject_profile", idCol: "subject_id",       textCol: "full_name" },

  // ── Short (used by entity routes, graph, etc.) ──
  alert:          { table: "alert",           idCol: "alert_id",         textCol: "description" },
  lead:           { table: "lead",            idCol: "lead_id",          textCol: "details" },
  case:           { table: "dopams_case",     idCol: "case_id",          textCol: "description" },
  subject:        { table: "subject_profile", idCol: "subject_id",       textCol: "full_name" },
  interrogation:  { table: "interrogation",   idCol: "interrogation_id", textCol: "raw_text" },
  evidence:       { table: "evidence_file",   idCol: "evidence_id",      textCol: "description" },

  // ── Plural (dashboard pendency / trends) ──
  alerts: { table: "alert",       idCol: "alert_id", textCol: "description" },
  cases:  { table: "dopams_case", idCol: "case_id",  textCol: "description" },
  leads:  { table: "lead",        idCol: "lead_id",  textCol: "details" },

  // ── Memo (NL query) ──
  memo:  { table: "memo", idCol: "memo_id", textCol: "subject" },
  memos: { table: "memo", idCol: "memo_id", textCol: "subject" },

  // ── Aliases for NL query plural forms ──
  profile:  { table: "subject_profile", idCol: "subject_id", textCol: "full_name" },
  profiles: { table: "subject_profile", idCol: "subject_id", textCol: "full_name" },
  subjects: { table: "subject_profile", idCol: "subject_id", textCol: "full_name" },
};

/**
 * Resolves an entityType string to validated table metadata.
 * Throws if the entity type is not in the allowlist.
 */
export function resolveEntityTable(entityType: string): EntityTableMeta {
  const mapping = ENTITY_TABLE_MAP[entityType.toLowerCase()];
  if (!mapping) throw new Error(`Unknown entity type: ${entityType}`);
  return mapping;
}

// ---------------------------------------------------------------------------
// Sort column / direction validation
// ---------------------------------------------------------------------------

/**
 * Validates a sort column name against an explicit allowlist.
 * Returns the validated column string (safe for SQL interpolation).
 * Throws if the column is not in the allowlist.
 */
export function validateSortColumn(col: string, allowlist: readonly string[]): string {
  if (!allowlist.includes(col)) throw new Error(`Invalid sort column: ${col}`);
  return col;
}

/**
 * Validates and normalises a sort direction string to "ASC" or "DESC".
 * Throws on any other value.
 */
export function validateSortDir(dir: string): "ASC" | "DESC" {
  const upper = dir.toUpperCase();
  if (upper !== "ASC" && upper !== "DESC") throw new Error(`Invalid sort direction: ${dir}`);
  return upper;
}
