CREATE TABLE IF NOT EXISTS config_version (
  config_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  config_key VARCHAR(128) NOT NULL,
  config_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  version_number INTEGER NOT NULL DEFAULT 1,
  created_by UUID REFERENCES user_account(user_id),
  approved_by UUID REFERENCES user_account(user_id),
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_config_version_key ON config_version(config_key);
