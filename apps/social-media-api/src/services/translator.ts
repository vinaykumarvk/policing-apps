import { query } from "../db";
import { llmComplete, isLlmAvailable } from "./llm-provider";

type DbRow = Record<string, unknown>;

const LANGUAGE_NAMES: Record<string, string> = {
  hi: "Hindi",
  te: "Telugu",
  en: "English",
  pa: "Punjabi",
  bn: "Bengali",
};

function detectLanguage(text: string): string {
  // Simple detection based on Unicode ranges
  if (/[\u0900-\u097F]/.test(text)) return "hi"; // Devanagari (Hindi)
  if (/[\u0C00-\u0C7F]/.test(text)) return "te"; // Telugu
  if (/[\u0A00-\u0A7F]/.test(text)) return "pa"; // Gurmukhi (Punjabi)
  if (/[\u0980-\u09FF]/.test(text)) return "bn"; // Bengali
  return "en";
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
  const languageName = LANGUAGE_NAMES[targetLanguage] || targetLanguage;

  // Check for existing LLM translation (skip old dictionary-based INTERNAL records)
  const existing = await query(
    `SELECT * FROM translation_record
      WHERE source_entity_type = $1
        AND source_entity_id = $2
        AND target_language = $3
        AND status = 'COMPLETED'
        AND provider != 'INTERNAL'
      ORDER BY created_at DESC LIMIT 1`,
    [sourceEntityType, sourceEntityId, targetLanguage],
  );

  if (existing.rows.length > 0) {
    // Still flag the original post language even if we have a cached translation
    await query(
      `UPDATE content_item SET language = $1 WHERE content_id = $2 AND (language IS NULL OR language = '')`,
      [sourceLang, sourceEntityId],
    ).catch(() => {});
    return existing.rows[0];
  }

  // Check LLM availability before attempting translation
  const llmAvailable = await isLlmAvailable();
  if (!llmAvailable) {
    return {
      status: "FAILED",
      error_message: "LLM not available — configure an API key in Administration → Model Admin → LLM Providers.",
      source_language: sourceLang,
      target_language: targetLanguage,
      detected_lang: detectedLang || sourceLang,
    };
  }

  // LLM translation
  try {
    const llmResult = await llmComplete({
      messages: [
        { role: "system", content: `You are a professional translator. Your task: translate the user's text into ${languageName}. Output ONLY the ${languageName} translation — no explanations, no labels, no original text.` },
        { role: "user", content: text },
      ],
      useCase: "TRANSLATION",
    });

    if (llmResult) {
      let translatedText = llmResult.content;
      try {
        const parsed = JSON.parse(llmResult.content);
        if (parsed.translated_text) translatedText = parsed.translated_text;
      } catch {
        // Use raw content as translation
      }

      const result = await query(
        `INSERT INTO translation_record
          (source_entity_type, source_entity_id, source_language, target_language, source_lang, target_lang, source_text, translated_text, status, provider, created_by, detected_lang, lang_confidence, llm_model, llm_tokens)
         VALUES ($1, $2, $3, $4, $13, $14, $5, $6, 'COMPLETED', $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [sourceEntityType, sourceEntityId, sourceLang, targetLanguage, text, translatedText, llmResult.provider, createdBy || null, detectedLang || sourceLang, langConfidence ?? null, llmResult.model, (llmResult.promptTokens || 0) + (llmResult.outputTokens || 0), sourceLang, targetLanguage],
      );

      // Flag the original post with detected source language
      await query(
        `UPDATE content_item SET language = $1 WHERE content_id = $2 AND (language IS NULL OR language = '')`,
        [sourceLang, sourceEntityId],
      ).catch(() => {});

      return result.rows[0];
    }
  } catch {
    // LLM call failed
  }

  // Return FAILED without inserting (translated_text has NOT NULL constraint)
  return {
    status: "FAILED",
    error_message: "LLM translation failed",
    source_language: sourceLang,
    target_language: targetLanguage,
    source_text: text,
    detected_lang: detectedLang || sourceLang,
  };
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
