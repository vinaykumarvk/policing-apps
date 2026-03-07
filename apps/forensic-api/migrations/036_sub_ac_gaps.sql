-- 036: Sub-acceptance-criteria gaps for Forensic
-- Adds note visibility, redaction profiles, step-up auth sessions, evidence dedup

-- Entity note visibility
ALTER TABLE entity_note ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'TEAM';

-- Redaction profiles
CREATE TABLE IF NOT EXISTS redaction_profile (
  profile_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_name  VARCHAR(255) NOT NULL,
  rules         JSONB NOT NULL DEFAULT '[]',
  created_by    UUID REFERENCES user_account(user_id),
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Step-up authentication sessions
CREATE TABLE IF NOT EXISTS stepup_session (
  session_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES user_account(user_id),
  action_type   VARCHAR(100) NOT NULL,
  verified_at   TIMESTAMPTZ DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes')
);

CREATE INDEX IF NOT EXISTS idx_stepup_session_user ON stepup_session (user_id, action_type, expires_at);

-- Evidence dedup
ALTER TABLE evidence_source ADD COLUMN IF NOT EXISTS dedup_status VARCHAR(20) DEFAULT 'UNIQUE';
