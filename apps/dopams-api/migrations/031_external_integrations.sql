-- FR-06: E-Courts legal status monitoring
-- FR-07: Financial intelligence / Unocross
-- FR-05: Monthly Report ingestion and KPI

CREATE TABLE IF NOT EXISTS court_case (
  court_case_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID REFERENCES subject_profile(subject_id),
  case_id UUID REFERENCES dopams_case(case_id),
  cnr_number TEXT UNIQUE,
  case_number TEXT,
  court_name TEXT,
  case_type TEXT,
  filing_date DATE,
  next_hearing_date DATE,
  legal_status TEXT DEFAULT 'PENDING' CHECK (legal_status IN ('PENDING', 'BAIL_GRANTED', 'BAIL_REJECTED', 'CONVICTED', 'ACQUITTED', 'APPEALED', 'DISPOSED')),
  last_order_summary TEXT,
  last_synced_at TIMESTAMPTZ,
  sync_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kpi_definition (
  kpi_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_name TEXT NOT NULL UNIQUE,
  kpi_code TEXT NOT NULL UNIQUE,
  description TEXT,
  calculation_query TEXT NOT NULL,
  unit TEXT DEFAULT 'count',
  target_value NUMERIC(10,2),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS monthly_report (
  report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_month DATE NOT NULL,
  unit_id UUID,
  kpi_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_by UUID,
  state_id TEXT DEFAULT 'DRAFT' CHECK (state_id IN ('DRAFT', 'GENERATED', 'REVIEWED', 'PUBLISHED')),
  row_version INTEGER DEFAULT 1,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (report_month, unit_id)
);

CREATE TABLE IF NOT EXISTS unocross_template (
  template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name TEXT NOT NULL,
  template_type TEXT NOT NULL CHECK (template_type IN ('HAWALA', 'BENAMI', 'SHELL_COMPANY', 'CRYPTO', 'CUSTOM')),
  parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
  query_template TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS financial_analysis_rule (
  rule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('THRESHOLD', 'PATTERN', 'NETWORK', 'ANOMALY')),
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  severity TEXT DEFAULT 'MEDIUM' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed KPIs
INSERT INTO kpi_definition (kpi_name, kpi_code, description, calculation_query, unit, target_value) VALUES
  ('Active Subjects', 'ACTIVE_SUBJECTS', 'Number of subjects under active monitoring', 'SELECT COUNT(*) FROM subject_profile WHERE monitoring_status = ''ACTIVE''', 'count', NULL),
  ('Lead Closure Rate', 'LEAD_CLOSURE_RATE', 'Percentage of leads closed within SLA', 'SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE state_id = ''CLOSED'') / NULLIF(COUNT(*), 0), 2) FROM lead WHERE created_at >= $1 AND created_at < $2', 'percent', 80),
  ('Case Resolution Time', 'CASE_RESOLUTION_DAYS', 'Average days to resolve cases', 'SELECT ROUND(AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400), 1) FROM dopams_case WHERE state_id = ''CLOSED'' AND created_at >= $1 AND created_at < $2', 'days', 30),
  ('Memo Generation Rate', 'MEMO_GEN_RATE', 'Memos generated per month', 'SELECT COUNT(*) FROM memo WHERE created_at >= $1 AND created_at < $2', 'count', NULL),
  ('Alert Response Time', 'ALERT_RESPONSE_HOURS', 'Average hours to acknowledge alerts', 'SELECT ROUND(AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600), 1) FROM alert WHERE state_id != ''NEW'' AND created_at >= $1 AND created_at < $2', 'hours', 4)
ON CONFLICT (kpi_code) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_court_case_subject ON court_case (subject_id);
CREATE INDEX IF NOT EXISTS idx_court_case_cnr ON court_case (cnr_number);
CREATE INDEX IF NOT EXISTS idx_court_case_hearing ON court_case (next_hearing_date) WHERE next_hearing_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_monthly_report_month ON monthly_report (report_month);
