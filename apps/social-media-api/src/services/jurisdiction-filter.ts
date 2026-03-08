import type { FetchedItem } from "../connectors/types";

export interface JurisdictionRow {
  district_name: string;
  city_names: string[];
  area_names: string[];
  alt_spellings: string[];
}

/**
 * Flatten all location terms into a single case-insensitive RegExp.
 */
export function buildLocationTermSet(rows: JurisdictionRow[]): RegExp | null {
  const terms: string[] = [];
  for (const row of rows) {
    terms.push(row.district_name);
    if (Array.isArray(row.city_names)) terms.push(...row.city_names);
    if (Array.isArray(row.area_names)) terms.push(...row.area_names);
    if (Array.isArray(row.alt_spellings)) terms.push(...row.alt_spellings);
  }

  const unique = [...new Set(terms.filter((t) => t && t.trim().length > 0))];
  if (unique.length === 0) return null;

  // Escape regex special characters and build alternation
  const escaped = unique.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`\\b(?:${escaped.join("|")})\\b`, "i");
}

/**
 * Filter items to those whose contentText matches at least one jurisdiction term.
 */
export function filterByJurisdiction(items: FetchedItem[], termSet: RegExp | null): FetchedItem[] {
  if (!termSet) return items; // No locations configured — pass all through
  return items.filter((item) => termSet.test(item.contentText));
}

/**
 * Return matched location terms from text (stored in metadata).
 */
export function findJurisdictionMatches(text: string, rows: JurisdictionRow[]): string[] {
  const matches: string[] = [];
  for (const row of rows) {
    const allTerms = [
      row.district_name,
      ...(Array.isArray(row.city_names) ? row.city_names : []),
      ...(Array.isArray(row.area_names) ? row.area_names : []),
      ...(Array.isArray(row.alt_spellings) ? row.alt_spellings : []),
    ];
    for (const term of allTerms) {
      if (!term) continue;
      const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (re.test(text)) matches.push(term);
    }
  }
  return [...new Set(matches)];
}
