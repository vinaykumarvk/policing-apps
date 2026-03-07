-- FR-10: Legal mapping rationale, reject, supervisor approval

ALTER TABLE legal_mapping ADD COLUMN IF NOT EXISTS rationale TEXT;
ALTER TABLE legal_mapping ADD COLUMN IF NOT EXISTS state_id TEXT DEFAULT 'SUGGESTED'
  CHECK (state_id IN ('SUGGESTED', 'CONFIRMED', 'REJECTED', 'PENDING_APPROVAL'));
ALTER TABLE legal_mapping ADD COLUMN IF NOT EXISTS rejected_by UUID;
ALTER TABLE legal_mapping ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;
ALTER TABLE legal_mapping ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE legal_mapping ADD COLUMN IF NOT EXISTS approved_by UUID;
ALTER TABLE legal_mapping ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_legal_mapping_state ON legal_mapping (state_id);
CREATE INDEX IF NOT EXISTS idx_legal_mapping_pending ON legal_mapping (state_id) WHERE state_id = 'PENDING_APPROVAL';
