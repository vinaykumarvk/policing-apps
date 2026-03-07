-- 038: FR-06 Taxonomy Versioning and Configurable Rules

CREATE TABLE IF NOT EXISTS taxonomy_version (
  version_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_no    INTEGER NOT NULL DEFAULT 1,
  is_active     BOOLEAN DEFAULT FALSE,
  description   TEXT,
  created_by    UUID REFERENCES user_account(user_id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  activated_at  TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_taxonomy_version_active ON taxonomy_version (is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_taxonomy_version_no ON taxonomy_version (version_no DESC);

CREATE TABLE IF NOT EXISTS taxonomy_rule (
  rule_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id    UUID NOT NULL REFERENCES taxonomy_version(version_id),
  category      VARCHAR(128) NOT NULL,
  pattern       TEXT NOT NULL,
  threshold     NUMERIC(5,4) DEFAULT 0.5,
  risk_weight   NUMERIC(3,2) DEFAULT 1.0,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_taxonomy_rule_version ON taxonomy_rule (version_id);
CREATE INDEX IF NOT EXISTS idx_taxonomy_rule_category ON taxonomy_rule (category) WHERE is_active = TRUE;

-- Add version_id to classification_result for tracking which taxonomy version was used
ALTER TABLE classification_result ADD COLUMN IF NOT EXISTS taxonomy_version_id UUID REFERENCES taxonomy_version(version_id);

-- FR-07: Priority queue routing on sm_alert based on risk score
ALTER TABLE sm_alert ADD COLUMN IF NOT EXISTS priority_queue VARCHAR(20) DEFAULT 'MEDIUM';
CREATE INDEX IF NOT EXISTS idx_sm_alert_queue ON sm_alert (priority_queue) WHERE state_id NOT IN ('DISMISSED', 'FALSE_POSITIVE', 'CLOSED');

-- FR-10: FALSE_POSITIVE state support
ALTER TABLE sm_alert ADD COLUMN IF NOT EXISTS false_positive_reason TEXT;
ALTER TABLE sm_alert ADD COLUMN IF NOT EXISTS false_positive_by UUID REFERENCES user_account(user_id);
ALTER TABLE sm_alert ADD COLUMN IF NOT EXISTS false_positive_at TIMESTAMPTZ;
