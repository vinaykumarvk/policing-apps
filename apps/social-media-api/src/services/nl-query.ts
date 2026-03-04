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
  buildSql: (matches: RegExpMatchArray, unitId: string | null) => { sql: string; params: unknown[] };
  entityType: string;
  summarize: (rows: DbRow[]) => string;
}

// ---------------------------------------------------------------------------
// Social-Media-specific query patterns
// ---------------------------------------------------------------------------

const PATTERNS: QueryPattern[] = [
  // ── Count queries ──────────────────────────────────────────────────────
  {
    regex: /how many (alerts?|cases?|evidence)/i,
    buildSql: (matches, unitId) => {
      const entityMap: Record<string, string> = {
        alert: "sm_alert",
        alerts: "sm_alert",
        case: "case_record",
        cases: "case_record",
        evidence: "evidence_item",
      };
      const table = entityMap[matches[1].toLowerCase()] || "sm_alert";
      const params: unknown[] = [];
      let whereClause = "";
      if (unitId && table === "sm_alert") {
        whereClause = " WHERE assigned_to IN (SELECT user_id FROM user_account WHERE unit_id = $1)";
        params.push(unitId);
      }
      return { sql: `SELECT COUNT(*) AS count FROM ${table}${whereClause}`, params };
    },
    entityType: "count",
    summarize: (rows) => `Total count: ${rows[0]?.count || 0}`,
  },

  // ── Open / pending / active items ──────────────────────────────────────
  {
    regex: /(?:show|list|find)\s+(?:all\s+)?(?:open|pending|active)\s+(alerts?|cases?)/i,
    buildSql: (matches, unitId) => {
      const entityMap: Record<string, { table: string; idCol: string }> = {
        alert: { table: "sm_alert", idCol: "alert_id" },
        alerts: { table: "sm_alert", idCol: "alert_id" },
        case: { table: "case_record", idCol: "case_id" },
        cases: { table: "case_record", idCol: "case_id" },
      };
      const entity = entityMap[matches[1].toLowerCase()] || entityMap.alert;
      const params: unknown[] = [];
      let paramIdx = 1;
      let unitClause = "";
      if (unitId && entity.table === "sm_alert") {
        unitClause = ` AND assigned_to IN (SELECT user_id FROM user_account WHERE unit_id = $${paramIdx})`;
        params.push(unitId);
        paramIdx++;
      }
      return {
        sql: `SELECT ${entity.idCol}, title, state_id, priority, created_at FROM ${entity.table} WHERE state_id NOT IN ('CLOSED', 'RESOLVED', 'ARCHIVED')${unitClause} ORDER BY created_at DESC LIMIT 20`,
        params,
      };
    },
    entityType: "list",
    summarize: (rows) => `Found ${rows.length} open items`,
  },

  // ── High / critical priority ───────────────────────────────────────────
  {
    regex: /(?:alerts?|cases?)\s+(?:with|having)\s+(?:high|critical)\s+priority/i,
    buildSql: (_, unitId) => {
      const params: unknown[] = [];
      let unitClause = "";
      if (unitId) {
        unitClause = ` AND assigned_to IN (SELECT user_id FROM user_account WHERE unit_id = $1)`;
        params.push(unitId);
      }
      return {
        sql: `SELECT alert_id, title, state_id, priority, created_at FROM sm_alert WHERE priority IN ('HIGH', 'CRITICAL')${unitClause} ORDER BY created_at DESC LIMIT 20`,
        params,
      };
    },
    entityType: "sm_alert",
    summarize: (rows) => `Found ${rows.length} high/critical priority alerts`,
  },

  // ── Recent / latest ────────────────────────────────────────────────────
  {
    regex: /(?:recent|latest|new)\s+(alerts?|cases?|evidence|content)/i,
    buildSql: (matches, unitId) => {
      const entityMap: Record<string, { table: string; idCol: string }> = {
        alert: { table: "sm_alert", idCol: "alert_id" },
        alerts: { table: "sm_alert", idCol: "alert_id" },
        case: { table: "case_record", idCol: "case_id" },
        cases: { table: "case_record", idCol: "case_id" },
        evidence: { table: "evidence_item", idCol: "evidence_id" },
        content: { table: "content_item", idCol: "content_id" },
      };
      const entity = entityMap[matches[1].toLowerCase()] || entityMap.alert;
      const params: unknown[] = [];
      let whereClause = "";
      if (unitId && entity.table === "sm_alert") {
        whereClause = " WHERE assigned_to IN (SELECT user_id FROM user_account WHERE unit_id = $1)";
        params.push(unitId);
      }
      const titleCol = entity.table === "content_item" ? "author_name" : "title";
      const extraCols = entity.table === "sm_alert" || entity.table === "case_record" ? ", state_id, priority" : "";
      return {
        sql: `SELECT ${entity.idCol}, ${titleCol} AS title${extraCols}, created_at FROM ${entity.table}${whereClause} ORDER BY created_at DESC LIMIT 10`,
        params,
      };
    },
    entityType: "list",
    summarize: (rows) => `Showing ${rows.length} most recent items`,
  },

  // ── Fallback: full-text search across alerts ───────────────────────────
  {
    regex: /.+/,
    buildSql: (matches, unitId) => {
      const term = matches[0].trim();
      const params: unknown[] = [term];
      let paramIdx = 2;
      let unitClause = "";
      if (unitId) {
        unitClause = ` AND assigned_to IN (SELECT user_id FROM user_account WHERE unit_id = $${paramIdx})`;
        params.push(unitId);
      }
      return {
        sql: `SELECT alert_id AS entity_id, 'sm_alert' AS entity_type, title, LEFT(description, 200) AS snippet FROM sm_alert WHERE (title ILIKE '%' || $1 || '%' OR description ILIKE '%' || $1 || '%')${unitClause} LIMIT 10`,
        params,
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
  unitId: string | null,
): Promise<QueryResult> {
  const startTime = Date.now();

  for (const pattern of PATTERNS) {
    const matches = queryText.match(pattern.regex);
    if (!matches) continue;

    const { sql, params } = pattern.buildSql(matches, unitId);

    try {
      const result = await query(sql, params);
      const executionTime = Date.now() - startTime;

      const citations = result.rows.map((row: DbRow) => ({
        entityType: (row.entity_type as string) || pattern.entityType,
        entityId: String(row.entity_id || row.alert_id || row.case_id || row.evidence_id || row.content_id || ""),
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
