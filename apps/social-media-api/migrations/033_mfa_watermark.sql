-- FR-17: MFA enforcement, watermark tracking

ALTER TABLE user_account ADD COLUMN IF NOT EXISTS mfa_enforced BOOLEAN DEFAULT FALSE;
ALTER TABLE user_account ADD COLUMN IF NOT EXISTS mfa_last_verified_at TIMESTAMPTZ;
ALTER TABLE user_account ADD COLUMN IF NOT EXISTS mfa_method TEXT CHECK (mfa_method IS NULL OR mfa_method IN ('TOTP', 'SMS', 'EMAIL'));

CREATE TABLE IF NOT EXISTS watermark_log (
  watermark_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  watermark_text TEXT NOT NULL,
  generated_by UUID NOT NULL,
  purpose TEXT,
  exported_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_watermark_entity ON watermark_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_watermark_user ON watermark_log (generated_by);
