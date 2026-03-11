import { query } from "../db";
import { resolveEntityTable } from "./entity-resolver";

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
  "नशा": "drugs",
  "तस्कर": "smuggler",
  "मामला": "case",
  "चेतावनी": "alert",
  "सूचना": "lead",
  "संदिग्ध": "suspect",
  "रिपोर्ट": "report",
  // Punjabi
  "ਪੁਲਿਸ": "police",
  "ਅਪਰਾਧ": "crime",
  "ਗ੍ਰਿਫ਼ਤਾਰ": "arrest",
  "ਸ਼ਿਕਾਇਤ": "complaint",
  "ਜਾਂਚ": "investigation",
  "ਨਸ਼ਾ": "drugs",
  "ਤਸਕਰ": "smuggler",
  "ਕੇਸ": "case",
  "ਚੇਤਾਵਨੀ": "alert",
  "ਸੂਚਨਾ": "lead",
  "ਸ਼ੱਕੀ": "suspect",
  "ਰਿਪੋਰਟ": "report",
};

function transliterate(input: string): string {
  let result = input;
  for (const [source, target] of Object.entries(TRANSLITERATION_MAP)) {
    result = result.replace(new RegExp(source, "g"), target);
  }
  return result;
}

/** Escape SQL LIKE/ILIKE wildcards so user input is treated as literal text. */
function escapeLikePattern(s: string): string {
  return s.replace(/[%_\\]/g, "\\$&");
}

// ---------------------------------------------------------------------------
// Search-table definitions (DOPAMS)
// ---------------------------------------------------------------------------

/** Title column per table — used for search result display. */
const SEARCH_TITLE_COL: Record<string, string> = {
  alert: "title",
  lead: "summary",
  subject_profile: "full_name",
};

function getSearchTables(): SearchTableDef[] {
  const entityTypes = ["dopams_alert", "dopams_lead", "dopams_subject"] as const;
  return entityTypes.map((et) => {
    const { table, idCol, textCol } = resolveEntityTable(et);
    return {
      entityType: et,
      tableName: table,
      idColumn: idCol,
      titleColumn: SEARCH_TITLE_COL[table] || textCol,
      textColumn: textCol,
    };
  });
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
      const escapedTerm = escapeLikePattern(searchTerm);
      sql = `SELECT ${table.idColumn} AS entity_id,
                    ${table.titleColumn} AS title,
                    LEFT(${table.textColumn}, 200) AS snippet,
                    ts_rank(search_vector, plainto_tsquery('english', $1)) AS score
             FROM ${table.tableName}
             WHERE search_vector @@ plainto_tsquery('english', $1)
                OR ${table.textColumn} ILIKE '%' || $2 || '%' ESCAPE '\\'
             ORDER BY score DESC
             LIMIT $3 OFFSET $4`;
      queryParams = [searchTerm, escapedTerm, limit, offset];
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
