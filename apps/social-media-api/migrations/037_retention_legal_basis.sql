-- 037: FR-03 Raw Retention and Legal Basis Fields
-- Add legal basis and retention tracking to content items

ALTER TABLE content_item ADD COLUMN IF NOT EXISTS legal_basis VARCHAR(100);
ALTER TABLE content_item ADD COLUMN IF NOT EXISTS retention_until TIMESTAMPTZ;
ALTER TABLE content_item ADD COLUMN IF NOT EXISTS retention_flagged BOOLEAN DEFAULT FALSE;

-- Add legal_basis to source_connector config as a default for ingested content
ALTER TABLE source_connector ADD COLUMN IF NOT EXISTS default_legal_basis VARCHAR(100);
ALTER TABLE source_connector ADD COLUMN IF NOT EXISTS default_retention_days INTEGER DEFAULT 365;

CREATE INDEX IF NOT EXISTS idx_content_retention ON content_item (retention_until) WHERE retention_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_content_retention_flagged ON content_item (retention_flagged) WHERE retention_flagged = TRUE;

-- Constraint on legal_basis values
ALTER TABLE content_item DROP CONSTRAINT IF EXISTS content_legal_basis_check;
ALTER TABLE content_item ADD CONSTRAINT content_legal_basis_check
  CHECK (legal_basis IS NULL OR legal_basis IN ('COURT_ORDER', 'INVESTIGATION', 'PUBLIC_INTEREST', 'REGULATORY', 'CONSENT', 'NATIONAL_SECURITY'));
