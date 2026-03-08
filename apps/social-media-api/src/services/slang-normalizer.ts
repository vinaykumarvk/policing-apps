import { query } from "../db";

export interface SlangMatch {
  term: string;
  normalizedForm: string;
  category: string;
  riskWeight: number;
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
