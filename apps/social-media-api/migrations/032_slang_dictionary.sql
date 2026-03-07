-- FR-05: Slang dictionary management

CREATE TABLE IF NOT EXISTS slang_dictionary (
  slang_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  term TEXT NOT NULL,
  normalized_form TEXT NOT NULL,
  language TEXT DEFAULT 'en',
  category TEXT NOT NULL,
  risk_weight NUMERIC(3,2) DEFAULT 1.0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (term, language)
);

CREATE INDEX IF NOT EXISTS idx_slang_term ON slang_dictionary (term) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_slang_category ON slang_dictionary (category) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_slang_language ON slang_dictionary (language);

-- Seed sample slang entries
INSERT INTO slang_dictionary (term, normalized_form, language, category, risk_weight) VALUES
  ('maal', 'drugs', 'hi', 'NARCOTICS', 1.5),
  ('chitta', 'heroin', 'pa', 'NARCOTICS', 2.0),
  ('pudiya', 'drug packet', 'hi', 'NARCOTICS', 1.8),
  ('supari', 'contract killing', 'hi', 'VIOLENCE', 2.5),
  ('hafta', 'extortion payment', 'hi', 'EXTORTION', 2.0),
  ('jugaad', 'illicit arrangement', 'hi', 'FRAUD', 1.0),
  ('katta', 'country-made pistol', 'hi', 'WEAPONS', 2.5),
  ('nasha', 'intoxicant', 'hi', 'NARCOTICS', 1.2),
  ('toli', 'gang', 'hi', 'ORGANIZED_CRIME', 1.5),
  ('setting', 'bribery arrangement', 'hi', 'CORRUPTION', 1.8)
ON CONFLICT (term, language) DO NOTHING;
