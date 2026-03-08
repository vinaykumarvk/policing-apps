-- Migration 052: Privacy & Civil Liberties Safeguards
-- Access justification, PII redaction logging, content source classification

-- Access justification table
CREATE TABLE IF NOT EXISTS access_justification (
  justification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_account(user_id),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  case_id UUID REFERENCES case_record(case_id),
  justification_type TEXT NOT NULL CHECK (justification_type IN ('CASE_RELATED', 'SUPERVISOR_DIRECTED', 'TRAINING', 'AUDIT', 'EMERGENCY', 'OTHER')),
  reason_text TEXT NOT NULL,
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_access_justification_user ON access_justification(user_id);
CREATE INDEX IF NOT EXISTS idx_access_justification_entity ON access_justification(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_access_justification_recent ON access_justification(user_id, entity_type, entity_id, accessed_at DESC);

-- Supervisor access stats view
CREATE OR REPLACE VIEW supervisor_access_stats AS
SELECT
  user_id,
  COUNT(*) AS total_accesses,
  COUNT(DISTINCT entity_id) AS unique_entities,
  MAX(accessed_at) AS last_access,
  COUNT(*) FILTER (WHERE justification_type = 'EMERGENCY') AS emergency_count,
  COUNT(*) FILTER (WHERE accessed_at >= NOW() - INTERVAL '24 hours') AS accesses_24h,
  COUNT(*) FILTER (WHERE accessed_at >= NOW() - INTERVAL '7 days') AS accesses_7d
FROM access_justification
GROUP BY user_id;

-- PII redaction log table
CREATE TABLE IF NOT EXISTS pii_redaction_log (
  redaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL REFERENCES content_item(content_id),
  field_name TEXT NOT NULL,
  redaction_type TEXT NOT NULL CHECK (redaction_type IN ('FULL', 'PARTIAL', 'PSEUDONYMIZED')),
  redacted_by TEXT NOT NULL DEFAULT 'SYSTEM',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pii_redaction_content ON pii_redaction_log(content_id);

-- Content source classification & auto-purge fields
ALTER TABLE content_item ADD COLUMN IF NOT EXISTS linked_case_id UUID REFERENCES case_record(case_id);
ALTER TABLE content_item ADD COLUMN IF NOT EXISTS auto_purge_eligible BOOLEAN DEFAULT FALSE;
ALTER TABLE content_item ADD COLUMN IF NOT EXISTS auto_purge_after TIMESTAMPTZ;
ALTER TABLE content_item ADD COLUMN IF NOT EXISTS content_source_type TEXT DEFAULT 'OSINT' CHECK (content_source_type IN ('OSINT', 'PRIVATE', 'SEMI_PRIVATE'));
ALTER TABLE content_item ADD COLUMN IF NOT EXISTS legal_authorization_required BOOLEAN DEFAULT FALSE;
ALTER TABLE content_item ADD COLUMN IF NOT EXISTS authorization_reference TEXT;
