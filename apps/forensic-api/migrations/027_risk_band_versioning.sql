-- FR-09: Add risk_band enum, scope_type to risk_score; create risk_scoring_rule table

ALTER TABLE risk_score ADD COLUMN IF NOT EXISTS risk_band TEXT
  CHECK (risk_band IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'));
ALTER TABLE risk_score ADD COLUMN IF NOT EXISTS scope_type TEXT
  CHECK (scope_type IN ('CASE', 'ENTITY', 'ARTIFACT', 'GLOBAL'));
ALTER TABLE risk_score ADD COLUMN IF NOT EXISTS scored_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE risk_score ADD COLUMN IF NOT EXISTS scored_by TEXT DEFAULT 'SYSTEM';

CREATE TABLE IF NOT EXISTS risk_scoring_rule (
  rule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name TEXT NOT NULL,
  description TEXT,
  conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  score_contribution NUMERIC(5,2) NOT NULL DEFAULT 0,
  risk_band TEXT CHECK (risk_band IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_until TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risk_scoring_rule_active ON risk_scoring_rule (is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_risk_score_band ON risk_score (risk_band) WHERE risk_band IS NOT NULL;
