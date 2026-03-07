-- 039: FR-09 Language Detection Metadata
-- Store detected language and confidence alongside translations

ALTER TABLE translation_record ADD COLUMN IF NOT EXISTS detected_lang VARCHAR(10);
ALTER TABLE translation_record ADD COLUMN IF NOT EXISTS lang_confidence NUMERIC(5,4);

CREATE INDEX IF NOT EXISTS idx_translation_detected_lang ON translation_record (detected_lang) WHERE detected_lang IS NOT NULL;
