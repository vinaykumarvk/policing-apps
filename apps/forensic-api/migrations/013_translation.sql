-- Tier 3F: Translation service support

CREATE TABLE IF NOT EXISTS translation_record (
  translation_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_entity_type TEXT NOT NULL,
  source_entity_id  UUID NOT NULL,
  source_language   TEXT NOT NULL DEFAULT 'auto',
  target_language   TEXT NOT NULL,
  source_text       TEXT NOT NULL,
  translated_text   TEXT,
  provider          TEXT DEFAULT 'INTERNAL',
  status            TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','COMPLETED','FAILED')),
  error_message     TEXT,
  created_by        UUID,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_translation_source ON translation_record(source_entity_type, source_entity_id);
CREATE INDEX IF NOT EXISTS idx_translation_status ON translation_record(status);
