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
// Forensic-specific query patterns
// ---------------------------------------------------------------------------

const PATTERNS: QueryPattern[] = [
  // ── Count queries ──────────────────────────────────────────────────────
  {
    regex: /how many (cases?|findings?|evidence|artifacts?|reports?)/i,
    buildSql: (matches) => {
      const entityMap: Record<string, string> = {
        case: "forensic_case",
        cases: "forensic_case",
        finding: "ai_finding",
        findings: "ai_finding",
        evidence: "evidence_source",
        artifact: "artifact",
        artifacts: "artifact",
        report: "report",
        reports: "report",
      };
      const table = entityMap[matches[1].toLowerCase()] || "forensic_case";
      return { sql: `SELECT COUNT(*) AS count FROM ${table}`, params: [] };
    },
    entityType: "count",
    summarize: (rows) => `Total count: ${rows[0]?.count || 0}`,
  },

  // ── Open / pending / active items ──────────────────────────────────────
  {
    regex: /(?:show|list|find)\s+(?:all\s+)?(?:open|pending|active|draft)\s+(cases?|findings?|reports?)/i,
    buildSql: (matches) => {
      const entityMap: Record<string, { table: string; idCol: string; stateFilter: string[] }> = {
        case: { table: "forensic_case", idCol: "case_id", stateFilter: ["CLOSED", "ARCHIVED"] },
        cases: { table: "forensic_case", idCol: "case_id", stateFilter: ["CLOSED", "ARCHIVED"] },
        finding: { table: "ai_finding", idCol: "finding_id", stateFilter: ["DISMISSED", "ARCHIVED"] },
        findings: { table: "ai_finding", idCol: "finding_id", stateFilter: ["DISMISSED", "ARCHIVED"] },
        report: { table: "report", idCol: "report_id", stateFilter: ["PUBLISHED", "ARCHIVED"] },
        reports: { table: "report", idCol: "report_id", stateFilter: ["PUBLISHED", "ARCHIVED"] },
      };
      const entity = entityMap[matches[1].toLowerCase()] || entityMap.case;
      const excluded = entity.stateFilter.map((s) => `'${s}'`).join(", ");
      const priorityCol = entity.table === "ai_finding" ? "severity" : "priority";
      const hasPriority = entity.table === "forensic_case" || entity.table === "ai_finding";
      const extraCols = hasPriority ? `, ${priorityCol} AS priority` : "";
      return {
        sql: `SELECT ${entity.idCol}, title, state_id${extraCols}, created_at FROM ${entity.table} WHERE state_id NOT IN (${excluded}) ORDER BY created_at DESC LIMIT 20`,
        params: [],
      };
    },
    entityType: "list",
    summarize: (rows) => `Found ${rows.length} open items`,
  },

  // ── High / critical severity findings ──────────────────────────────────
  {
    regex: /(?:findings?)\s+(?:with|having)\s+(?:high|critical)\s+(?:severity|priority)/i,
    buildSql: () => ({
      sql: `SELECT finding_id, title, state_id, severity, confidence, created_at FROM ai_finding WHERE severity IN ('HIGH', 'CRITICAL') ORDER BY created_at DESC LIMIT 20`,
      params: [],
    }),
    entityType: "ai_finding",
    summarize: (rows) => `Found ${rows.length} high/critical severity findings`,
  },

  // ── Unreviewed findings ────────────────────────────────────────────────
  {
    regex: /(?:unreviewed|pending\s+review)\s+(findings?)/i,
    buildSql: () => ({
      sql: `SELECT finding_id, title, severity, confidence, created_at FROM ai_finding WHERE state_id = 'UNREVIEWED' ORDER BY created_at DESC LIMIT 20`,
      params: [],
    }),
    entityType: "ai_finding",
    summarize: (rows) => `Found ${rows.length} unreviewed findings`,
  },

  // ── Recent / latest ────────────────────────────────────────────────────
  {
    regex: /(?:recent|latest|new)\s+(cases?|findings?|evidence|artifacts?|reports?)/i,
    buildSql: (matches) => {
      const entityMap: Record<string, { table: string; idCol: string; titleCol: string }> = {
        case: { table: "forensic_case", idCol: "case_id", titleCol: "title" },
        cases: { table: "forensic_case", idCol: "case_id", titleCol: "title" },
        finding: { table: "ai_finding", idCol: "finding_id", titleCol: "title" },
        findings: { table: "ai_finding", idCol: "finding_id", titleCol: "title" },
        evidence: { table: "evidence_source", idCol: "evidence_id", titleCol: "file_name" },
        artifact: { table: "artifact", idCol: "artifact_id", titleCol: "artifact_type" },
        artifacts: { table: "artifact", idCol: "artifact_id", titleCol: "artifact_type" },
        report: { table: "report", idCol: "report_id", titleCol: "title" },
        reports: { table: "report", idCol: "report_id", titleCol: "title" },
      };
      const entity = entityMap[matches[1].toLowerCase()] || entityMap.case;
      const hasState = ["forensic_case", "ai_finding", "evidence_source", "report"].includes(entity.table);
      const extraCols = hasState ? ", state_id" : "";
      return {
        sql: `SELECT ${entity.idCol}, ${entity.titleCol} AS title${extraCols}, created_at FROM ${entity.table} ORDER BY created_at DESC LIMIT 10`,
        params: [],
      };
    },
    entityType: "list",
    summarize: (rows) => `Showing ${rows.length} most recent items`,
  },

  // ── Evidence by case ───────────────────────────────────────────────────
  {
    regex: /evidence\s+(?:for|in)\s+case\s+(.+)/i,
    buildSql: (matches) => {
      const caseRef = matches[1].trim();
      return {
        sql: `SELECT es.evidence_id, es.file_name AS title, es.source_type, es.state_id, es.created_at FROM evidence_source es JOIN forensic_case fc ON fc.case_id = es.case_id WHERE fc.case_number ILIKE '%' || $1 || '%' OR fc.title ILIKE '%' || $1 || '%' ORDER BY es.created_at DESC LIMIT 20`,
        params: [caseRef],
      };
    },
    entityType: "evidence_source",
    summarize: (rows) => `Found ${rows.length} evidence items for this case`,
  },

  // ── Fallback: full-text search across cases and findings ───────────────
  {
    regex: /.+/,
    buildSql: (matches) => {
      const term = matches[0].trim();
      return {
        sql: `SELECT case_id AS entity_id, 'forensic_case' AS entity_type, title, LEFT(description, 200) AS snippet FROM forensic_case WHERE (title ILIKE '%' || $1 || '%' OR description ILIKE '%' || $1 || '%') LIMIT 10`,
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
        entityId: String(row.entity_id || row.case_id || row.finding_id || row.evidence_id || row.artifact_id || row.report_id || ""),
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
