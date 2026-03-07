-- FR-07: Configurable keyword dictionaries, regex, provenance

CREATE TABLE IF NOT EXISTS keyword_dictionary (
  dictionary_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dictionary_name TEXT NOT NULL,
  category TEXT NOT NULL,
  keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
  regex_patterns JSONB DEFAULT '[]'::jsonb,
  version INTEGER DEFAULT 1,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE classification_result ADD COLUMN IF NOT EXISTS dictionary_id UUID REFERENCES keyword_dictionary(dictionary_id);
ALTER TABLE classification_result ADD COLUMN IF NOT EXISTS provenance JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_keyword_dict_category ON keyword_dictionary (category) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_classification_dictionary ON classification_result (dictionary_id) WHERE dictionary_id IS NOT NULL;

-- Seed default dictionaries
INSERT INTO keyword_dictionary (dictionary_name, category, keywords, regex_patterns, description) VALUES
  ('Drug Terminology', 'NARCOTICS', '["heroin", "cocaine", "meth", "cannabis", "ganja", "charas", "brown sugar", "smack", "MDMA", "LSD"]'::jsonb, '["\\b\\d+\\s*(kg|gm|gram)s?\\s*(heroin|cocaine|meth)"]'::jsonb, 'Common drug-related keywords and patterns'),
  ('Financial Fraud', 'FINANCIAL_CRIME', '["hawala", "benami", "shell company", "money laundering", "tax evasion"]'::jsonb, '["\\bINR\\s*\\d{2,}\\s*(lakh|crore)"]'::jsonb, 'Financial crime indicators'),
  ('Weapon Terms', 'WEAPONS', '["AK-47", "pistol", "revolver", "grenade", "IED", "detonator", "ammunition"]'::jsonb, '["\\b\\d+\\s*(rounds|cartridges|weapons)"]'::jsonb, 'Weapon and arms-related terminology'),
  ('Communication Indicators', 'COMMUNICATION', '["encrypted", "VPN", "dark web", "tor", "signal", "telegram"]'::jsonb, '[]'::jsonb, 'Suspicious communication patterns')
ON CONFLICT DO NOTHING;
