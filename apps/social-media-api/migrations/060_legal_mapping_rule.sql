-- ═══════════════════════════════════════════════════════════════════════════
-- ENT-13: legal_mapping_rule — Rule-based legal section mapping engine
-- ENT-14: Extend legal_mapping with rule references and reviewer workflow
-- ═══════════════════════════════════════════════════════════════════════════

-- ENT-13: Legal mapping rule definitions
CREATE TABLE IF NOT EXISTS legal_mapping_rule (
  rule_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_code       VARCHAR(50) NOT NULL UNIQUE,
  law_name        VARCHAR(200) NOT NULL,
  provision_code  VARCHAR(100) NOT NULL,
  rule_expression JSONB NOT NULL DEFAULT '{}',
  severity_weight NUMERIC(5,2) NOT NULL DEFAULT 1.0,
  version_no      INTEGER NOT NULL DEFAULT 1,
  approval_status VARCHAR(30) NOT NULL DEFAULT 'DRAFT'
    CHECK (approval_status IN ('DRAFT','PENDING_REVIEW','APPROVED','PUBLISHED','REJECTED','SUPERSEDED','ROLLED_BACK')),
  effective_from  TIMESTAMPTZ,
  effective_to    TIMESTAMPTZ,
  created_by      UUID,
  approved_by     UUID,
  approved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_legal_mapping_rule_status ON legal_mapping_rule (approval_status);
CREATE INDEX IF NOT EXISTS idx_legal_mapping_rule_law ON legal_mapping_rule (law_name, provision_code);

-- ENT-14: Extend legal_mapping with rule references and reviewer workflow
ALTER TABLE legal_mapping ADD COLUMN IF NOT EXISTS rule_id UUID REFERENCES legal_mapping_rule(rule_id);
ALTER TABLE legal_mapping ADD COLUMN IF NOT EXISTS provision_code VARCHAR(100);
ALTER TABLE legal_mapping ADD COLUMN IF NOT EXISTS rationale_text TEXT;
ALTER TABLE legal_mapping ADD COLUMN IF NOT EXISTS confidence_score NUMERIC(5,2);
ALTER TABLE legal_mapping ADD COLUMN IF NOT EXISTS reviewer_status VARCHAR(20) DEFAULT 'PENDING'
  CHECK (reviewer_status IN ('PENDING','APPROVED','REJECTED'));
ALTER TABLE legal_mapping ADD COLUMN IF NOT EXISTS reviewed_by UUID;
ALTER TABLE legal_mapping ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_legal_mapping_rule_ref ON legal_mapping (rule_id);
CREATE INDEX IF NOT EXISTS idx_legal_mapping_reviewer ON legal_mapping (reviewer_status);
