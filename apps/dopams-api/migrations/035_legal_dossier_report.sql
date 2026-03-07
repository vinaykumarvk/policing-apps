-- FR-21: Legal section versioning, effective dating
-- FR-09: Dossier assembly CRUD and export
-- FR-08: Interrogation report with template
-- FR-26: Model governance production enforcement

-- Statute versioning
ALTER TABLE statute_library ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE statute_library ADD COLUMN IF NOT EXISTS effective_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE statute_library ADD COLUMN IF NOT EXISTS superseded_by UUID REFERENCES statute_library(statute_id);

-- Dossier
CREATE TABLE IF NOT EXISTS dossier (
  dossier_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_ref TEXT UNIQUE,
  title TEXT NOT NULL,
  subject_id UUID REFERENCES subject_profile(subject_id),
  case_id UUID REFERENCES dopams_case(case_id),
  content_sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  state_id TEXT DEFAULT 'DRAFT' CHECK (state_id IN ('DRAFT', 'ASSEMBLED', 'REVIEWED', 'EXPORTED')),
  row_version INTEGER DEFAULT 1,
  assembled_at TIMESTAMPTZ,
  exported_format TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Report templates
CREATE TABLE IF NOT EXISTS report_template (
  template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name TEXT NOT NULL UNIQUE,
  template_type TEXT NOT NULL CHECK (template_type IN ('INTERROGATION', 'DOSSIER', 'MONTHLY', 'ANALYSIS', 'CUSTOM')),
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  header_config JSONB DEFAULT '{}'::jsonb,
  footer_config JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Interrogation reports
CREATE TABLE IF NOT EXISTS interrogation_report (
  report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_ref TEXT UNIQUE,
  subject_id UUID REFERENCES subject_profile(subject_id),
  case_id UUID REFERENCES dopams_case(case_id),
  template_id UUID REFERENCES report_template(template_id),
  interrogation_date TIMESTAMPTZ NOT NULL,
  location TEXT,
  officer_id UUID NOT NULL,
  witness_ids JSONB DEFAULT '[]'::jsonb,
  questions_answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary TEXT,
  state_id TEXT DEFAULT 'DRAFT' CHECK (state_id IN ('DRAFT', 'COMPLETED', 'REVIEWED', 'SIGNED')),
  row_version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Model governance production enforcement
ALTER TABLE model_registry ADD COLUMN IF NOT EXISTS is_production BOOLEAN DEFAULT FALSE;
ALTER TABLE model_registry ADD COLUMN IF NOT EXISTS min_accuracy_threshold NUMERIC(5,4) DEFAULT 0.80;
ALTER TABLE model_registry ADD COLUMN IF NOT EXISTS fallback_model_id UUID REFERENCES model_registry(model_id);

CREATE INDEX IF NOT EXISTS idx_dossier_subject ON dossier (subject_id);
CREATE INDEX IF NOT EXISTS idx_dossier_case ON dossier (case_id);
CREATE INDEX IF NOT EXISTS idx_interrogation_subject ON interrogation_report (subject_id);
CREATE INDEX IF NOT EXISTS idx_interrogation_case ON interrogation_report (case_id);
CREATE INDEX IF NOT EXISTS idx_statute_effective ON statute_library (effective_date, is_active);
CREATE INDEX IF NOT EXISTS idx_model_production ON model_registry (is_production) WHERE is_production = TRUE;

-- Seed report templates
INSERT INTO report_template (template_name, template_type, sections) VALUES
  ('Standard Interrogation', 'INTERROGATION', '[{"type": "text", "title": "Preamble"}, {"type": "keyValue", "title": "Subject Details"}, {"type": "table", "title": "Questions & Answers"}, {"type": "text", "title": "Summary"}]'::jsonb),
  ('Subject Dossier', 'DOSSIER', '[{"type": "keyValue", "title": "Personal Information"}, {"type": "text", "title": "Criminal History"}, {"type": "table", "title": "Associates"}, {"type": "text", "title": "Intelligence Summary"}, {"type": "table", "title": "Legal Cases"}]'::jsonb)
ON CONFLICT (template_name) DO NOTHING;
