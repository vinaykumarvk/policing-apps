import { query } from "../db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DbRow = Record<string, unknown>;

export interface QueryResult {
  summary: string;
  data: DbRow[];
  citations: { entityType: string; entityId: string; field: string }[];
}

interface QueryPattern {
  regex: RegExp;
  buildSql: (matches: RegExpMatchArray, userId: string) => { sql: string; params: unknown[] };
  entityType: string;
  summarize: (rows: DbRow[]) => string;
}

// ---------------------------------------------------------------------------
// DOPAMS-specific query patterns
// ---------------------------------------------------------------------------

const PATTERNS: QueryPattern[] = [
  // ── Count queries ──────────────────────────────────────────────────────
  {
    regex: /how many (alerts?|cases?|leads?|subjects?|profiles?)/i,
    buildSql: (matches) => {
      const entityMap: Record<string, string> = {
        alert: "alert",
        alerts: "alert",
        case: "dopams_case",
        cases: "dopams_case",
        lead: "lead",
        leads: "lead",
        subject: "subject_profile",
        subjects: "subject_profile",
        profile: "subject_profile",
        profiles: "subject_profile",
      };
      const table = entityMap[matches[1].toLowerCase()] || "alert";
      return { sql: `SELECT COUNT(*) AS count FROM ${table}`, params: [] };
    },
    entityType: "count",
    summarize: (rows) => `Total count: ${rows[0]?.count || 0}`,
  },

  // ── Open / pending / active items ──────────────────────────────────────
  {
    regex: /(?:show|list|find)\s+(?:all\s+)?(?:open|pending|active)\s+(alerts?|cases?|leads?)/i,
    buildSql: (matches) => {
      const entityMap: Record<string, { table: string; idCol: string; titleCol: string }> = {
        alert: { table: "alert", idCol: "alert_id", titleCol: "title" },
        alerts: { table: "alert", idCol: "alert_id", titleCol: "title" },
        case: { table: "dopams_case", idCol: "case_id", titleCol: "title" },
        cases: { table: "dopams_case", idCol: "case_id", titleCol: "title" },
        lead: { table: "lead", idCol: "lead_id", titleCol: "summary" },
        leads: { table: "lead", idCol: "lead_id", titleCol: "summary" },
      };
      const entity = entityMap[matches[1].toLowerCase()] || entityMap.alert;
      const priorityCol = entity.table === "alert" ? "severity" : "priority";
      return {
        sql: `SELECT ${entity.idCol}, ${entity.titleCol} AS title, state_id, ${priorityCol} AS priority, created_at FROM ${entity.table} WHERE state_id NOT IN ('CLOSED', 'RESOLVED', 'ARCHIVED') ORDER BY created_at DESC LIMIT 20`,
        params: [],
      };
    },
    entityType: "list",
    summarize: (rows) => `Found ${rows.length} open items`,
  },

  // ── High / critical severity alerts ────────────────────────────────────
  {
    regex: /(?:alerts?)\s+(?:with|having)\s+(?:high|critical)\s+(?:severity|priority)/i,
    buildSql: () => ({
      sql: `SELECT alert_id, title, state_id, severity, created_at FROM alert WHERE severity IN ('HIGH', 'CRITICAL') ORDER BY created_at DESC LIMIT 20`,
      params: [],
    }),
    entityType: "alert",
    summarize: (rows) => `Found ${rows.length} high/critical severity alerts`,
  },

  // ── High-risk subjects ─────────────────────────────────────────────────
  {
    regex: /(?:high[- ]?risk|risky)\s+(subjects?|profiles?)/i,
    buildSql: () => ({
      sql: `SELECT subject_id, full_name AS title, state_id, risk_score, created_at FROM subject_profile WHERE risk_score >= 70 ORDER BY risk_score DESC LIMIT 20`,
      params: [],
    }),
    entityType: "subject_profile",
    summarize: (rows) => `Found ${rows.length} high-risk subject profiles`,
  },

  // ── Recent / latest ────────────────────────────────────────────────────
  {
    regex: /(?:recent|latest|new)\s+(alerts?|cases?|leads?|subjects?|profiles?|memos?)/i,
    buildSql: (matches) => {
      const entityMap: Record<string, { table: string; idCol: string; titleCol: string }> = {
        alert: { table: "alert", idCol: "alert_id", titleCol: "title" },
        alerts: { table: "alert", idCol: "alert_id", titleCol: "title" },
        case: { table: "dopams_case", idCol: "case_id", titleCol: "title" },
        cases: { table: "dopams_case", idCol: "case_id", titleCol: "title" },
        lead: { table: "lead", idCol: "lead_id", titleCol: "summary" },
        leads: { table: "lead", idCol: "lead_id", titleCol: "summary" },
        subject: { table: "subject_profile", idCol: "subject_id", titleCol: "full_name" },
        subjects: { table: "subject_profile", idCol: "subject_id", titleCol: "full_name" },
        profile: { table: "subject_profile", idCol: "subject_id", titleCol: "full_name" },
        profiles: { table: "subject_profile", idCol: "subject_id", titleCol: "full_name" },
        memo: { table: "memo", idCol: "memo_id", titleCol: "subject" },
        memos: { table: "memo", idCol: "memo_id", titleCol: "subject" },
      };
      const entity = entityMap[matches[1].toLowerCase()] || entityMap.alert;
      const hasState = entity.table !== "subject_profile" || true; // all tables have state_id
      const extraCols = hasState ? ", state_id" : "";
      return {
        sql: `SELECT ${entity.idCol}, ${entity.titleCol} AS title${extraCols}, created_at FROM ${entity.table} ORDER BY created_at DESC LIMIT 10`,
        params: [],
      };
    },
    entityType: "list",
    summarize: (rows) => `Showing ${rows.length} most recent items`,
  },

  // ── Fallback: full-text search across alerts, leads, and cases ─────────
  {
    regex: /.+/,
    buildSql: (matches) => {
      const term = matches[0].trim();
      return {
        sql: `SELECT alert_id AS entity_id, 'alert' AS entity_type, title, LEFT(description, 200) AS snippet FROM alert WHERE (title ILIKE '%' || $1 || '%' OR description ILIKE '%' || $1 || '%') LIMIT 10`,
        params: [term],
      };
    },
    entityType: "search",
    summarize: (rows) =>
      rows.length > 0
        ? `Found ${rows.length} matching results`
        : "No results found for your query",
  },
];

// ---------------------------------------------------------------------------
// Execute NL query
// ---------------------------------------------------------------------------

export async function executeNlQuery(
  queryText: string,
  userId: string,
  _unitId: string | null,
): Promise<QueryResult> {
  const startTime = Date.now();

  for (const pattern of PATTERNS) {
    const matches = queryText.match(pattern.regex);
    if (!matches) continue;

    const { sql, params } = pattern.buildSql(matches, userId);

    try {
      const result = await query(sql, params);
      const executionTime = Date.now() - startTime;

      const citations = result.rows.map((row: DbRow) => ({
        entityType: (row.entity_type as string) || pattern.entityType,
        entityId: String(row.entity_id || row.alert_id || row.case_id || row.lead_id || row.subject_id || row.memo_id || ""),
        field: String(row.title || row.snippet || ""),
      }));

      // Log the query
      await query(
        `INSERT INTO nl_query_log (user_id, query_text, generated_sql, result_summary, citations, status, execution_time_ms)
         VALUES ($1, $2, $3, $4, $5, 'COMPLETED', $6)`,
        [userId, queryText, sql, pattern.summarize(result.rows), JSON.stringify(citations), executionTime],
      );

      return {
        summary: pattern.summarize(result.rows),
        data: result.rows,
        citations,
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await query(
        `INSERT INTO nl_query_log (user_id, query_text, generated_sql, status, error_message)
         VALUES ($1, $2, $3, 'FAILED', $4)`,
        [userId, queryText, sql, errMsg],
      );
      throw err;
    }
  }

  return { summary: "Could not understand the query", data: [], citations: [] };
}

// ---------------------------------------------------------------------------
// Query history
// ---------------------------------------------------------------------------

export async function getQueryHistory(userId: string, limit = 20): Promise<DbRow[]> {
  const result = await query(
    `SELECT * FROM nl_query_log WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, limit],
  );
  return result.rows;
}
