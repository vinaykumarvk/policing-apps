-- FR-19: Cross-platform Content Monitoring
CREATE TABLE IF NOT EXISTS content_item (
  content_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_platform VARCHAR(100) NOT NULL,
  content_type VARCHAR(50) NOT NULL DEFAULT 'TEXT',
  raw_text TEXT,
  media_urls JSONB DEFAULT '[]'::jsonb,
  author_handle VARCHAR(255),
  captured_at TIMESTAMPTZ,
  classified_category VARCHAR(100),
  risk_score NUMERIC(5,2),
  state_id VARCHAR(20) NOT NULL DEFAULT 'NEW'
    CHECK (state_id IN ('NEW', 'REVIEWING', 'ESCALATED', 'CLOSED')),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_content_item_platform ON content_item (source_platform);
CREATE INDEX idx_content_item_state ON content_item (state_id);
CREATE INDEX idx_content_item_risk ON content_item (risk_score DESC NULLS LAST);
CREATE INDEX idx_content_item_captured ON content_item (captured_at DESC);

CREATE TABLE IF NOT EXISTS monitoring_rule (
  rule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_type VARCHAR(50) NOT NULL,
  pattern TEXT NOT NULL,
  platforms JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_monitoring_rule_active ON monitoring_rule (is_active) WHERE is_active = TRUE;
