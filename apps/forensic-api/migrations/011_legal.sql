-- Tier 3E: Legal Mapping Engine
-- Statute library and enhanced entity-to-statute mapping
-- Note: replaces the basic legal_mapping table from 001_init.sql

CREATE TABLE IF NOT EXISTS statute_library (
  statute_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  act_name TEXT NOT NULL,
  section TEXT NOT NULL,
  description TEXT,
  keywords TEXT[] DEFAULT '{}',
  penalty_summary TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_statute_section ON statute_library(section);
CREATE INDEX IF NOT EXISTS idx_statute_keywords ON statute_library USING GIN(keywords);

-- Migrate existing legal_mapping data and replace with new schema
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'legal_mapping'
      AND table_schema = 'public'
  ) THEN
    -- Preserve old data in a backup table
    CREATE TABLE IF NOT EXISTS legal_mapping_v1_backup AS
      SELECT * FROM legal_mapping;
    DROP TABLE legal_mapping;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS legal_mapping (
  mapping_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  statute_id UUID NOT NULL REFERENCES statute_library(statute_id),
  mapping_source TEXT DEFAULT 'AUTO' CHECK (mapping_source IN ('AUTO','MANUAL')),
  confidence NUMERIC(5,2),
  confirmed BOOLEAN DEFAULT false,
  confirmed_by UUID,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_legal_mapping_entity ON legal_mapping(entity_type, entity_id);

-- Seed common Indian statutes
INSERT INTO statute_library (act_name, section, description, keywords) VALUES
  ('Indian Penal Code', '420', 'Cheating and dishonestly inducing delivery of property', ARRAY['fraud', 'cheating', 'scam', 'fake']),
  ('Indian Penal Code', '354', 'Assault or criminal force to woman with intent to outrage her modesty', ARRAY['harassment', 'assault', 'woman', 'modesty']),
  ('Indian Penal Code', '506', 'Punishment for criminal intimidation', ARRAY['threat', 'intimidation', 'criminal']),
  ('Indian Penal Code', '509', 'Word, gesture or act intended to insult the modesty of a woman', ARRAY['harassment', 'insult', 'woman']),
  ('Indian Penal Code', '153A', 'Promoting enmity between different groups', ARRAY['hate', 'communal', 'enmity', 'religion']),
  ('Indian Penal Code', '295A', 'Deliberate and malicious acts intended to outrage religious feelings', ARRAY['religion', 'blasphemy', 'sentiments']),
  ('Indian Penal Code', '499', 'Defamation', ARRAY['defamation', 'reputation', 'libel']),
  ('Indian Penal Code', '500', 'Punishment for defamation', ARRAY['defamation', 'punishment']),
  ('IT Act', '66', 'Computer related offences', ARRAY['hacking', 'computer', 'cyber', 'unauthorized']),
  ('IT Act', '66A', 'Punishment for sending offensive messages', ARRAY['offensive', 'message', 'social media', 'online']),
  ('IT Act', '66C', 'Punishment for identity theft', ARRAY['identity', 'theft', 'impersonation', 'fraud']),
  ('IT Act', '66D', 'Punishment for cheating by personation using computer resource', ARRAY['cheating', 'impersonation', 'computer', 'online']),
  ('IT Act', '66E', 'Punishment for violation of privacy', ARRAY['privacy', 'intimate', 'image', 'video']),
  ('IT Act', '67', 'Punishment for publishing or transmitting obscene material', ARRAY['obscene', 'pornography', 'explicit']),
  ('IT Act', '67A', 'Punishment for publishing sexually explicit material', ARRAY['sexual', 'explicit', 'material']),
  ('IT Act', '67B', 'Punishment for publishing child sexually explicit material', ARRAY['child', 'minor', 'csam', 'exploitation']),
  ('NDPS Act', '20', 'Punishment for contravention in relation to cannabis', ARRAY['cannabis', 'marijuana', 'ganja', 'drugs']),
  ('NDPS Act', '21', 'Punishment for contravention in relation to manufactured drugs', ARRAY['drugs', 'narcotics', 'manufactured']),
  ('NDPS Act', '22', 'Punishment for contravention in relation to psychotropic substances', ARRAY['psychotropic', 'drugs', 'substance']),
  ('POCSO Act', '4', 'Punishment for penetrative sexual assault on child', ARRAY['child', 'minor', 'sexual', 'assault']),
  ('POCSO Act', '8', 'Punishment for sexual assault on child', ARRAY['child', 'minor', 'sexual']),
  ('POCSO Act', '12', 'Punishment for sexual harassment of child', ARRAY['child', 'minor', 'harassment'])
ON CONFLICT DO NOTHING;
