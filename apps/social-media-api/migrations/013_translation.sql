-- Tier 3F: Extend existing translation_record with generic entity translation support
-- The original table was content_item–specific; these columns enable entity-agnostic translation.

ALTER TABLE translation_record
  ADD COLUMN IF NOT EXISTS source_entity_type TEXT,
  ADD COLUMN IF NOT EXISTS source_entity_id   UUID,
  ADD COLUMN IF NOT EXISTS source_language     TEXT,
  ADD COLUMN IF NOT EXISTS target_language     TEXT,
  ADD COLUMN IF NOT EXISTS source_text         TEXT,
  ADD COLUMN IF NOT EXISTS provider            TEXT DEFAULT 'INTERNAL',
  ADD COLUMN IF NOT EXISTS status              TEXT DEFAULT 'COMPLETED',
  ADD COLUMN IF NOT EXISTS error_message       TEXT,
  ADD COLUMN IF NOT EXISTS created_by          UUID;

-- Back-fill source_language / target_language from legacy columns
UPDATE translation_record
   SET source_language = source_lang,
       target_language = target_lang
 WHERE source_language IS NULL;

-- Add constraint on status for new rows
-- (Cannot add CHECK to existing column with ALTER in all PG versions, so use a trigger-free approach)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'translation_record_status_check'
  ) THEN
    ALTER TABLE translation_record
      ADD CONSTRAINT translation_record_status_check
      CHECK (status IN ('PENDING','COMPLETED','FAILED'));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_translation_source ON translation_record(source_entity_type, source_entity_id);
CREATE INDEX IF NOT EXISTS idx_translation_status ON translation_record(status);
