import { query } from "../db";

export interface SearchResult {
  entityType: string;
  entityId: string;
  title: string;
  snippet: string;
  score: number;
}

interface SearchTableDef {
  entityType: string;
  tableName: string;
  idColumn: string;
  titleColumn: string;
  textColumn: string;
}

// ---------------------------------------------------------------------------
// Basic transliteration lookup (Hindi / Punjabi to English phonetic)
// ---------------------------------------------------------------------------

const TRANSLITERATION_MAP: Record<string, string> = {
  // Hindi
  "पुलिस": "police",
  "अपराध": "crime",
  "गिरफ्तार": "arrest",
  "शिकायत": "complaint",
  "जांच": "investigation",
  "सबूत": "evidence",
  "मामला": "case",
  "फोरेंसिक": "forensic",
  "डिजिटल": "digital",
  "रिपोर्ट": "report",
  "विश्लेषण": "analysis",
  // Punjabi
  "ਪੁਲਿਸ": "police",
  "ਅਪਰਾਧ": "crime",
  "ਗ੍ਰਿਫ਼ਤਾਰ": "arrest",
  "ਸ਼ਿਕਾਇਤ": "complaint",
  "ਜਾਂਚ": "investigation",
  "ਸਬੂਤ": "evidence",
  "ਕੇਸ": "case",
  "ਫੋਰੈਂਸਿਕ": "forensic",
  "ਡਿਜੀਟਲ": "digital",
  "ਰਿਪੋਰਟ": "report",
  "ਵਿਸ਼ਲੇਸ਼ਣ": "analysis",
};

function transliterate(input: string): string {
  let result = input;
  for (const [source, target] of Object.entries(TRANSLITERATION_MAP)) {
    result = result.replace(new RegExp(source, "g"), target);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Search-table definitions (Forensic)
// ---------------------------------------------------------------------------

function getSearchTables(): SearchTableDef[] {
  return [
    {
      entityType: "forensic_case",
      tableName: "forensic_case",
      idColumn: "case_id",
      titleColumn: "title",
      textColumn: "description",
    },
    {
      entityType: "forensic_finding",
      tableName: "ai_finding",
      idColumn: "finding_id",
      titleColumn: "title",
      textColumn: "description",
    },
  ];
}

// ---------------------------------------------------------------------------
// Global search across all entity types
// ---------------------------------------------------------------------------

export async function globalSearch(params: {
  q: string;
  fuzzy?: boolean;
  transliterate?: boolean;
  limit?: number;
  offset?: number;
  entityTypes?: string[];
}): Promise<{ results: SearchResult[]; total: number }> {
  const { q, fuzzy = false, limit = 20, offset = 0, entityTypes } = params;
  let searchTerm = q.trim();

  if (params.transliterate) {
    searchTerm = transliterate(searchTerm);
  }

  const results: SearchResult[] = [];
  const tables = getSearchTables();

  for (const table of tables) {
    if (entityTypes && !entityTypes.includes(table.entityType)) continue;

    let sql: string;
    let queryParams: unknown[];

    if (fuzzy) {
      // Trigram similarity search
      sql = `SELECT ${table.idColumn} AS entity_id,
                    ${table.titleColumn} AS title,
                    LEFT(${table.textColumn}, 200) AS snippet,
                    similarity(${table.textColumn}, $1) AS score
             FROM ${table.tableName}
             WHERE similarity(${table.textColumn}, $1) > 0.1
             ORDER BY score DESC
             LIMIT $2 OFFSET $3`;
      queryParams = [searchTerm, limit, offset];
    } else {
      // Full-text search with ts_rank, falling back to ILIKE
      sql = `SELECT ${table.idColumn} AS entity_id,
                    ${table.titleColumn} AS title,
                    LEFT(${table.textColumn}, 200) AS snippet,
                    ts_rank(search_vector, plainto_tsquery('english', $1)) AS score
             FROM ${table.tableName}
             WHERE search_vector @@ plainto_tsquery('english', $1)
                OR ${table.textColumn} ILIKE '%' || $1 || '%'
             ORDER BY score DESC
             LIMIT $2 OFFSET $3`;
      queryParams = [searchTerm, limit, offset];
    }

    try {
      const result = await query(sql, queryParams);
      for (const row of result.rows) {
        results.push({
          entityType: table.entityType,
          entityId: row.entity_id,
          title: row.title || "Untitled",
          snippet: row.snippet || "",
          score: parseFloat(row.score) || 0,
        });
      }
    } catch (err) {
      // Table/column may not exist yet (migration pending) -- skip silently
      console.warn(`Search skipped for ${table.tableName}:`, (err as Error).message);
    }
  }

  // Sort combined results by score descending
  results.sort((a, b) => b.score - a.score);

  return {
    results: results.slice(0, limit),
    total: results.length,
  };
}
