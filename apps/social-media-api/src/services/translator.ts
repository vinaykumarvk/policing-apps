import { query } from "../db";

type DbRow = Record<string, unknown>;

// Simple internal translation mappings (Telugu/Hindi -> English)
// In production, this would integrate with Google Translate, Azure Translator, or similar
const DICTIONARY: Record<string, Record<string, string>> = {
  "hi_to_en": {
    "पुलिस": "police",
    "अपराध": "crime",
    "गिरफ्तार": "arrested",
    "शिकायत": "complaint",
    "जांच": "investigation",
    "रिपोर्ट": "report",
    "अपराधी": "criminal",
    "सबूत": "evidence",
    "गवाह": "witness",
    "अदालत": "court",
    "मुकदमा": "case",
    "आरोपी": "accused",
    "पीड़ित": "victim",
    "चोरी": "theft",
    "लूट": "robbery",
    "धोखाधड़ी": "fraud",
    "हत्या": "murder",
    "ड्रग्स": "drugs",
    "सोशल मीडिया": "social media",
    "साइबर अपराध": "cybercrime",
  },
  "te_to_en": {
    "పోలీసు": "police",
    "నేరం": "crime",
    "అరెస్ట్": "arrest",
    "ఫిర్యాదు": "complaint",
    "దర్యాప్తు": "investigation",
    "నివేదిక": "report",
    "నేరస్తుడు": "criminal",
    "సాక్ష్యం": "evidence",
    "సాక్షి": "witness",
    "కోర్టు": "court",
    "కేసు": "case",
    "నిందితుడు": "accused",
    "బాధితుడు": "victim",
  },
};

function detectLanguage(text: string): string {
  // Simple detection based on Unicode ranges
  if (/[\u0900-\u097F]/.test(text)) return "hi"; // Devanagari (Hindi)
  if (/[\u0C00-\u0C7F]/.test(text)) return "te"; // Telugu
  if (/[\u0A00-\u0A7F]/.test(text)) return "pa"; // Gurmukhi (Punjabi)
  if (/[\u0980-\u09FF]/.test(text)) return "bn"; // Bengali
  return "en";
}

function dictionaryTranslate(text: string, sourceLang: string, targetLang: string): string {
  const dictKey = `${sourceLang}_to_${targetLang}`;
  const dict = DICTIONARY[dictKey];
  if (!dict) return text; // No dictionary available for this pair

  let result = text;
  for (const [source, target] of Object.entries(dict)) {
    result = result.replace(new RegExp(source, "g"), target);
  }
  return result;
}

export async function translateText(params: {
  sourceEntityType: string;
  sourceEntityId: string;
  text: string;
  targetLanguage: string;
  createdBy?: string;
  detectedLang?: string;
  langConfidence?: number;
}): Promise<DbRow> {
  const { sourceEntityType, sourceEntityId, text, targetLanguage, createdBy, detectedLang, langConfidence } = params;

  const sourceLang = detectedLang || detectLanguage(text);

  // Check for existing translation
  const existing = await query(
    `SELECT * FROM translation_record
      WHERE source_entity_type = $1
        AND source_entity_id = $2
        AND target_language = $3
        AND status = 'COMPLETED'
      ORDER BY created_at DESC LIMIT 1`,
    [sourceEntityType, sourceEntityId, targetLanguage],
  );

  if (existing.rows.length > 0) {
    return existing.rows[0];
  }

  try {
    const translated = dictionaryTranslate(text, sourceLang, targetLanguage);

    const result = await query(
      `INSERT INTO translation_record
        (source_entity_type, source_entity_id, source_language, target_language, source_text, translated_text, status, provider, created_by, detected_lang, lang_confidence)
       VALUES ($1, $2, $3, $4, $5, $6, 'COMPLETED', 'INTERNAL', $7, $8, $9)
       RETURNING *`,
      [sourceEntityType, sourceEntityId, sourceLang, targetLanguage, text, translated, createdBy || null, detectedLang || sourceLang, langConfidence ?? null],
    );

    return result.rows[0];
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const result = await query(
      `INSERT INTO translation_record
        (source_entity_type, source_entity_id, source_language, target_language, source_text, status, error_message, provider, created_by, detected_lang, lang_confidence)
       VALUES ($1, $2, $3, $4, $5, 'FAILED', $6, 'INTERNAL', $7, $8, $9)
       RETURNING *`,
      [sourceEntityType, sourceEntityId, sourceLang, targetLanguage, text, errMsg, createdBy || null, detectedLang || sourceLang, langConfidence ?? null],
    );
    return result.rows[0];
  }
}

export async function getTranslations(sourceEntityType: string, sourceEntityId: string): Promise<DbRow[]> {
  const result = await query(
    `SELECT * FROM translation_record
      WHERE source_entity_type = $1
        AND source_entity_id = $2
      ORDER BY created_at DESC`,
    [sourceEntityType, sourceEntityId],
  );
  return result.rows;
}
