/**
 * FR-09: Language detection with confidence scoring.
 * Uses Unicode range analysis to detect the primary script/language.
 */

interface LanguageDetectionResult {
  language: string;
  confidence: number;
  script: string;
}

interface ScriptRange {
  name: string;
  language: string;
  regex: RegExp;
}

const SCRIPT_RANGES: ScriptRange[] = [
  { name: "Devanagari", language: "hi", regex: /[\u0900-\u097F]/g },
  { name: "Telugu", language: "te", regex: /[\u0C00-\u0C7F]/g },
  { name: "Gurmukhi", language: "pa", regex: /[\u0A00-\u0A7F]/g },
  { name: "Bengali", language: "bn", regex: /[\u0980-\u09FF]/g },
  { name: "Tamil", language: "ta", regex: /[\u0B80-\u0BFF]/g },
  { name: "Kannada", language: "kn", regex: /[\u0C80-\u0CFF]/g },
  { name: "Malayalam", language: "ml", regex: /[\u0D00-\u0D7F]/g },
  { name: "Arabic", language: "ar", regex: /[\u0600-\u06FF]/g },
  { name: "CJK", language: "zh", regex: /[\u4E00-\u9FFF]/g },
  { name: "Hangul", language: "ko", regex: /[\uAC00-\uD7AF]/g },
  { name: "Cyrillic", language: "ru", regex: /[\u0400-\u04FF]/g },
  { name: "Latin", language: "en", regex: /[a-zA-Z]/g },
];

/**
 * Detect the primary language of a text string with confidence scoring.
 * Confidence is calculated as the proportion of script-specific characters
 * to total characters in the text.
 */
export function detectLanguageWithConfidence(text: string): LanguageDetectionResult {
  if (!text || text.trim().length === 0) {
    return { language: "und", confidence: 0, script: "Unknown" };
  }

  const cleanText = text.replace(/[\s\d\p{P}]/gu, "");
  const totalChars = cleanText.length;

  if (totalChars === 0) {
    return { language: "und", confidence: 0, script: "Unknown" };
  }

  let bestMatch: { language: string; script: string; count: number } = {
    language: "en",
    script: "Latin",
    count: 0,
  };

  for (const scriptRange of SCRIPT_RANGES) {
    const matches = cleanText.match(scriptRange.regex);
    const count = matches ? matches.length : 0;
    if (count > bestMatch.count) {
      bestMatch = { language: scriptRange.language, script: scriptRange.name, count };
    }
  }

  const confidence = totalChars > 0 ? Math.round((bestMatch.count / totalChars) * 10000) / 10000 : 0;

  return {
    language: bestMatch.language,
    confidence: Math.min(confidence, 1.0),
    script: bestMatch.script,
  };
}
