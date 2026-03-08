-- 041: FR-07 AC-05 Queue routing rules for content triage

CREATE TABLE IF NOT EXISTS queue_routing_rule (
  rule_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name     VARCHAR(200) NOT NULL,
  category      VARCHAR(128),
  min_risk_score NUMERIC(5,2) DEFAULT 0,
  max_risk_score NUMERIC(5,2) DEFAULT 100,
  target_queue  VARCHAR(50) NOT NULL DEFAULT 'MEDIUM',
  priority_order INTEGER DEFAULT 0,
  is_active     BOOLEAN DEFAULT TRUE,
  created_by    UUID REFERENCES user_account(user_id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_queue_routing_active ON queue_routing_rule (is_active, priority_order) WHERE is_active = TRUE;

-- Add queue_name column to content_item for routed triage
ALTER TABLE content_item ADD COLUMN IF NOT EXISTS queue_name VARCHAR(50) DEFAULT 'DEFAULT';
CREATE INDEX IF NOT EXISTS idx_content_item_queue ON content_item (queue_name) WHERE queue_name IS NOT NULL;
