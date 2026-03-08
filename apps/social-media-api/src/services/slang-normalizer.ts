import { query } from "../db";

export interface SlangMatch {
  term: string;
  normalizedForm: string;
  category: string;
  riskWeight: number;
}

interface SlangEntry {
  term: string;
  normalized_form: string;
  category: string;
  risk_weight: string;
  romanized_form: string | null;
}

/** In-memory cache for slang dictionary entries (60s TTL) */
let slangCache: { entries: SlangEntry[]; version: string; expiry: number } | null = null;
const CACHE_TTL_MS = 60_000;

/**
 * Invalidate the in-memory slang dictionary cache.
 * Call this when the dictionary is updated via API.
 */
export function invalidateSlangCache(): void {
  slangCache = null;
}

/**
 * Load slang entries from cache or DB.
 */
async function loadSlangEntries(): Promise<{ entries: SlangEntry[]; version: string }> {
  const now = Date.now();
  if (slangCache && now < slangCache.expiry) {
    return { entries: slangCache.entries, version: slangCache.version };
  }

  const result = await query(
    `SELECT term, normalized_form, category, risk_weight, romanized_form FROM slang_dictionary WHERE is_active = TRUE`,
  );

  const versionResult = await query(
    `SELECT COUNT(*)::int AS entry_count, MAX(updated_at) AS last_updated FROM slang_dictionary WHERE is_active = TRUE`,
  );
  const vCount = versionResult.rows[0]?.entry_count || 0;
  const vDate = versionResult.rows[0]?.last_updated ? new Date(versionResult.rows[0].last_updated).toISOString().slice(0, 10) : "unknown";
  const version = `v${vCount}-${vDate}`;

  slangCache = { entries: result.rows, version, expiry: now + CACHE_TTL_MS };
  return { entries: result.rows, version };
}

/**
 * Normalize text by replacing slang terms with their standard forms.
 * Returns the normalized text and matched slang entries.
 */
export async function normalizeSlang(text: string): Promise<{ normalizedText: string; matches: SlangMatch[]; dictionaryVersion: string }> {
  const result = await query(
    `SELECT term, normalized_form, category, risk_weight FROM slang_dictionary WHERE is_active = TRUE`,
  );

  // FR-05 AC-04: Compute dictionary version from count + latest update timestamp
  const versionResult = await query(
    `SELECT COUNT(*)::int AS entry_count, MAX(updated_at) AS last_updated FROM slang_dictionary WHERE is_active = TRUE`,
  );
  const vCount = versionResult.rows[0]?.entry_count || 0;
  const vDate = versionResult.rows[0]?.last_updated ? new Date(versionResult.rows[0].last_updated).toISOString().slice(0, 10) : "unknown";
  const dictionaryVersion = `v${vCount}-${vDate}`;

  let normalizedText = text;
  const matches: SlangMatch[] = [];

  for (const row of result.rows) {
    const regex = new RegExp(`\\b${escapeRegex(row.term)}\\b`, "gi");
    if (regex.test(normalizedText)) {
      matches.push({
        term: row.term,
        normalizedForm: row.normalized_form,
        category: row.category,
        riskWeight: parseFloat(row.risk_weight),
      });
      // Append normalized form for classification but keep original for display
      normalizedText = normalizedText.replace(regex, `${row.term} [${row.normalized_form}]`);
    }
  }

  return { normalizedText, matches, dictionaryVersion };
}

/**
 * Cached version of normalizeSlang that also matches against romanized_form.
 * Uses 60s TTL cache to avoid DB hit per post in a batch.
 */
export async function normalizeSlangCached(text: string): Promise<{ normalizedText: string; matches: SlangMatch[]; dictionaryVersion: string }> {
  const { entries, version } = await loadSlangEntries();

  let normalizedText = text;
  const matches: SlangMatch[] = [];

  for (const row of entries) {
    // Match against both term and romanized_form
    const termsToMatch = [row.term];
    if (row.romanized_form && row.romanized_form !== row.term) {
      termsToMatch.push(row.romanized_form);
    }

    for (const matchTerm of termsToMatch) {
      const regex = new RegExp(`\\b${escapeRegex(matchTerm)}\\b`, "gi");
      if (regex.test(normalizedText)) {
        // Avoid duplicate matches for the same dictionary entry
        if (!matches.some(m => m.term === row.term && m.normalizedForm === row.normalized_form)) {
          matches.push({
            term: row.term,
            normalizedForm: row.normalized_form,
            category: row.category,
            riskWeight: parseFloat(row.risk_weight),
          });
          normalizedText = normalizedText.replace(regex, `${matchTerm} [${row.normalized_form}]`);
        }
        break;
      }
    }
  }

  return { normalizedText, matches, dictionaryVersion: version };
}

/**
 * Calculate additional risk score contribution from slang matches.
 */
export function calculateSlangRiskBonus(matches: SlangMatch[]): number {
  if (matches.length === 0) return 0;
  // Sum risk weights, capped at 20 bonus points
  const total = matches.reduce((sum, m) => sum + m.riskWeight * 5, 0);
  return Math.min(total, 20);
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
