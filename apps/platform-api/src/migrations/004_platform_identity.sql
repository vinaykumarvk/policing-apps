CREATE TABLE IF NOT EXISTS platform.platform_user (
  user_id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  totp_secret TEXT NOT NULL,
  display_name TEXT NOT NULL,
  persona TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  unit_ids TEXT[] NOT NULL DEFAULT '{}',
  org_scope TEXT NOT NULL,
  jurisdiction JSONB NOT NULL,
  clearance JSONB NOT NULL,
  assignment JSONB NOT NULL DEFAULT
    '{"case_ids":[],"queue_ids":[],"evidence_ids":[],"jurisdiction_wide":false,"domain_wide":false}',
  purpose_allowed TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT platform_user_status_ck CHECK (status IN ('active', 'disabled'))
);

CREATE TABLE IF NOT EXISTS platform.platform_user_entitlement (
  user_id TEXT NOT NULL REFERENCES platform.platform_user (user_id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  domain TEXT NOT NULL,
  permissions TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, module, domain)
);

CREATE INDEX IF NOT EXISTS platform_user_entitlement_user_idx
  ON platform.platform_user_entitlement (user_id);
