-- FR-02: Evidence quarantine flow with supervisor approval
ALTER TABLE evidence_source ADD COLUMN IF NOT EXISTS quarantine_status VARCHAR(20) DEFAULT 'CLEAR';
ALTER TABLE evidence_source ADD COLUMN IF NOT EXISTS quarantine_reason TEXT;
ALTER TABLE evidence_source ADD COLUMN IF NOT EXISTS quarantine_approved_by UUID REFERENCES user_account(user_id);

CREATE INDEX IF NOT EXISTS idx_evidence_quarantine ON evidence_source(quarantine_status) WHERE quarantine_status != 'CLEAR';
