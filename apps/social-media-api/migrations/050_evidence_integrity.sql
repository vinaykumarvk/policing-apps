-- Migration 050: Evidence Integrity (ISO 27037)
-- Adds verification tracking, legal holds, retention enhancements

-- Evidence verification fields
ALTER TABLE evidence_item ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES user_account(user_id);
ALTER TABLE evidence_item ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE evidence_item ADD COLUMN IF NOT EXISTS hash_verification_result TEXT CHECK (hash_verification_result IN ('MATCH', 'MISMATCH', 'NO_FILE', 'NO_HASH'));
ALTER TABLE evidence_item ADD COLUMN IF NOT EXISTS is_original BOOLEAN DEFAULT TRUE;
ALTER TABLE evidence_item ADD COLUMN IF NOT EXISTS parent_evidence_id UUID REFERENCES evidence_item(evidence_id);
ALTER TABLE evidence_item ADD COLUMN IF NOT EXISTS hash_algorithm TEXT DEFAULT 'SHA-256';
ALTER TABLE evidence_item ADD COLUMN IF NOT EXISTS capturing_officer_id UUID REFERENCES user_account(user_id);

-- Evidence legal hold table
CREATE TABLE IF NOT EXISTS evidence_legal_hold (
  hold_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_id UUID NOT NULL REFERENCES evidence_item(evidence_id),
  hold_reason TEXT NOT NULL,
  legal_reference TEXT,
  held_by UUID NOT NULL REFERENCES user_account(user_id),
  released_by UUID REFERENCES user_account(user_id),
  held_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  released_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evidence_legal_hold_evidence ON evidence_legal_hold(evidence_id);
CREATE INDEX IF NOT EXISTS idx_evidence_legal_hold_active ON evidence_legal_hold(evidence_id) WHERE is_active = TRUE;

-- Data retention policy enhancements
ALTER TABLE data_retention_policy ADD COLUMN IF NOT EXISTS jurisdiction_id UUID REFERENCES organization_unit(unit_id);
ALTER TABLE data_retention_policy ADD COLUMN IF NOT EXISTS nearing_expiry_days INTEGER DEFAULT 30;

-- Content retention warning flag
ALTER TABLE content_item ADD COLUMN IF NOT EXISTS retention_expiry_warning BOOLEAN DEFAULT FALSE;
