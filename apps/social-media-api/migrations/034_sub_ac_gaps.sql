-- 034: Sub-acceptance-criteria gaps for Social Media
-- Adds translation glossary, slang submission workflow

-- Translation glossary
CREATE TABLE IF NOT EXISTS translation_glossary (
  term_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_lang   VARCHAR(10) NOT NULL,
  target_lang   VARCHAR(10) NOT NULL,
  source_term   TEXT NOT NULL,
  target_term   TEXT NOT NULL,
  domain        VARCHAR(100) DEFAULT 'general',
  created_by    UUID REFERENCES user_account(user_id),
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_glossary_term_unique ON translation_glossary (source_lang, target_lang, source_term, domain) WHERE is_active = TRUE;

-- Slang dictionary submission workflow
ALTER TABLE slang_dictionary ADD COLUMN IF NOT EXISTS submission_status VARCHAR(20) DEFAULT 'APPROVED';
ALTER TABLE slang_dictionary ADD COLUMN IF NOT EXISTS submitted_by UUID;
ALTER TABLE slang_dictionary ADD COLUMN IF NOT EXISTS reviewed_by UUID;
ALTER TABLE slang_dictionary ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
