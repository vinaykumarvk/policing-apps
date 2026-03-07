-- 038: Sub-acceptance-criteria gaps for DOPAMS
-- Adds checksums, quarantine, dedup scoring, alert suppression, export justification

-- Source document checksum + quarantine
ALTER TABLE source_document ADD COLUMN IF NOT EXISTS checksum_sha256 VARCHAR(64);
ALTER TABLE source_document ADD COLUMN IF NOT EXISTS quarantine_status VARCHAR(20) DEFAULT 'CLEAR';
ALTER TABLE source_document ADD COLUMN IF NOT EXISTS quarantine_reason TEXT;
CREATE INDEX IF NOT EXISTS idx_source_document_checksum ON source_document (checksum_sha256);

-- Lead duplicate scoring
ALTER TABLE lead ADD COLUMN IF NOT EXISTS duplicate_score NUMERIC(5,4) DEFAULT 0;
ALTER TABLE lead ADD COLUMN IF NOT EXISTS auto_memo_generated BOOLEAN DEFAULT FALSE;

-- Alert suppression rules
CREATE TABLE IF NOT EXISTS alert_suppression_rule (
  rule_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern       JSONB NOT NULL,
  suppress_until TIMESTAMPTZ,
  reason        TEXT NOT NULL,
  created_by    UUID REFERENCES user_account(user_id),
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Export justification
ALTER TABLE export_log ADD COLUMN IF NOT EXISTS justification TEXT NOT NULL DEFAULT '';
