/**
 * Text normalization pipeline for narcotics detection.
 * Pure synchronous module — no DB or I/O dependencies.
 *
 * Transforms raw text before keyword matching to defeat common evasion techniques:
 * - Unicode NFKD normalization (fullwidth chars -> ASCII)
 * - Homoglyph replacement (Cyrillic/Greek lookalikes -> Latin)
 * - Leetspeak decoding (c0caine -> cocaine)
 * - Separator collapse (c.o.c.a.i.n.e -> cocaine, only when result is a known drug term)
 * - Zero-width character stripping
 */

export interface NormalizationResult {
  /** The normalized text */
  normalizedText: string;
  /** Which normalizations were applied */
  appliedTransforms: string[];
  /** Original text (for reference) */
  originalText: string;
}

/** Known drug terms for separator-collapse validation */
const KNOWN_DRUG_TERMS = new Set([
  "cocaine", "heroin", "meth", "methamphetamine", "fentanyl",
  "cannabis", "marijuana", "weed", "ganja", "charas", "hashish",
  "mdma", "ecstasy", "molly", "ketamine", "lsd", "acid",
  "opium", "morphine", "codeine", "oxycodone", "xanax",
  "crack", "coke", "speed", "amphetamine", "crystal",
  "narcotic", "narcotics", "drug", "drugs",
  "chitta", "maal", "afeem", "nashe", "sulfa", "phukki", "brown sugar",
  // Telugu romanized drug terms
  "ganjayi", "afeemu", "saarayi", "naatusaara", "kallu", "mandu", "podi",
  "gullu", "ganji", "poudar", "tikke", "saruku", "gaddi", "gaanja", "charas",
]);

/**
 * Homoglyph map: Cyrillic/Greek/special chars -> ASCII Latin equivalents.
 * Covers the most common lookalikes used for evasion.
 */
const HOMOGLYPH_MAP: Record<string, string> = {
  // Cyrillic -> Latin
  "\u0410": "A", "\u0430": "a", // A a
  "\u0412": "B", "\u0432": "b", // V v (looks like B)
  "\u0421": "C", "\u0441": "c", // S s
  "\u0415": "E", "\u0435": "e", // Ye ye
  "\u041D": "H", "\u043D": "h", // N n
  "\u041A": "K", "\u043A": "k", // K k
  "\u041C": "M", "\u043C": "m", // M m
  "\u041E": "O", "\u043E": "o", // O o
  "\u0420": "P", "\u0440": "p", // R r
  "\u0422": "T", "\u0442": "t", // T t
  "\u0425": "X", "\u0445": "x", // Kh kh
  "\u0423": "Y", "\u0443": "y", // U u
  // Greek -> Latin
  "\u0391": "A", "\u03B1": "a", // Alpha
  "\u0392": "B", "\u03B2": "b", // Beta
  "\u0395": "E", "\u03B5": "e", // Epsilon
  "\u0397": "H", "\u03B7": "h", // Eta
  "\u0399": "I", "\u03B9": "i", // Iota
  "\u039A": "K", "\u03BA": "k", // Kappa
  "\u039C": "M", "\u03BC": "m", // Mu
  "\u039D": "N", "\u03BD": "n", // Nu
  "\u039F": "O", "\u03BF": "o", // Omicron
  "\u03A1": "P", "\u03C1": "p", // Rho
  "\u03A4": "T", "\u03C4": "t", // Tau
  "\u03A7": "X", "\u03C7": "x", // Chi
  "\u03A5": "Y", "\u03C5": "y", // Upsilon
  "\u0396": "Z", "\u03B6": "z", // Zeta
};

/** Leetspeak -> letter map */
const LEET_MAP: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "8": "b",
  "@": "a",
  "!": "i",
};

/** Zero-width characters to strip */
const ZERO_WIDTH_RE = /[\u200B\u200C\u200D\uFEFF\u00AD\u2060\u2061\u2062\u2063\u2064]/g;

/** Separator pattern: single chars separated by dots, hyphens, spaces, or underscores */
const SEPARATOR_RE = /\b([a-zA-Z])(?:[.\-\s_]([a-zA-Z])){2,}\b/g;

/**
 * Strip zero-width characters.
 */
function stripZeroWidth(text: string): { text: string; applied: boolean } {
  const result = text.replace(ZERO_WIDTH_RE, "");
  return { text: result, applied: result !== text };
}

/**
 * Unicode NFKD normalization — converts fullwidth chars, ligatures, etc. to ASCII equivalents.
 */
function normalizeUnicode(text: string): { text: string; applied: boolean } {
  const result = text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  return { text: result, applied: result !== text };
}

/**
 * Replace homoglyphs (Cyrillic/Greek lookalikes) with ASCII Latin.
 */
function replaceHomoglyphs(text: string): { text: string; applied: boolean } {
  let applied = false;
  const result = Array.from(text).map(ch => {
    const replacement = HOMOGLYPH_MAP[ch];
    if (replacement) {
      applied = true;
      return replacement;
    }
    return ch;
  }).join("");
  return { text: result, applied };
}

/**
 * Decode leetspeak substitutions. Only replaces digits/symbols that appear
 * adjacent to letters (to avoid mangling pure numbers).
 */
function decodeLeetspeak(text: string): { text: string; applied: boolean } {
  let applied = false;
  // Match sequences that mix letters and leet chars
  const result = text.replace(/[a-zA-Z0-9@!]+/g, (word) => {
    // Only decode if the word has both letters and leet chars
    const hasLetters = /[a-zA-Z]/.test(word);
    const hasLeet = /[0-9@!]/.test(word);
    if (!hasLetters || !hasLeet) return word;

    const decoded = Array.from(word).map(ch => {
      const replacement = LEET_MAP[ch];
      if (replacement) {
        applied = true;
        return replacement;
      }
      return ch;
    }).join("");
    return decoded;
  });
  return { text: result, applied };
}

/**
 * Collapse separated characters (c.o.c.a.i.n.e -> cocaine).
 * Only collapses when the result matches a known drug term to avoid mangling normal text.
 */
function collapseSeparators(text: string): { text: string; applied: boolean } {
  let applied = false;
  const result = text.replace(
    /(?<![a-zA-Z])([a-zA-Z])(?:[.\-\s_]([a-zA-Z])){2,}(?![a-zA-Z])/g,
    (match) => {
      const collapsed = match.replace(/[.\-\s_]/g, "").toLowerCase();
      if (KNOWN_DRUG_TERMS.has(collapsed)) {
        applied = true;
        return collapsed;
      }
      return match;
    },
  );
  return { text: result, applied };
}

/**
 * Main normalization pipeline. Applies all transforms in order.
 */
export function normalizeText(text: string): NormalizationResult {
  if (!text) {
    return { normalizedText: "", appliedTransforms: [], originalText: "" };
  }

  const originalText = text;
  const appliedTransforms: string[] = [];

  // Step 1: Strip zero-width characters
  const zw = stripZeroWidth(text);
  if (zw.applied) appliedTransforms.push("zero_width_strip");
  text = zw.text;

  // Step 2: Unicode NFKD normalization
  const uni = normalizeUnicode(text);
  if (uni.applied) appliedTransforms.push("unicode_nfkd");
  text = uni.text;

  // Step 3: Homoglyph replacement
  const homo = replaceHomoglyphs(text);
  if (homo.applied) appliedTransforms.push("homoglyph_replace");
  text = homo.text;

  // Step 4: Leetspeak decoding
  const leet = decodeLeetspeak(text);
  if (leet.applied) appliedTransforms.push("leetspeak_decode");
  text = leet.text;

  // Step 5: Separator collapse (only for known drug terms)
  const sep = collapseSeparators(text);
  if (sep.applied) appliedTransforms.push("separator_collapse");
  text = sep.text;

  return { normalizedText: text, appliedTransforms, originalText };
}

export { KNOWN_DRUG_TERMS };
