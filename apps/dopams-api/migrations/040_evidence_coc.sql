-- FR-22: Digital Evidence Chain of Custody
CREATE TABLE IF NOT EXISTS evidence_item (
  evidence_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID,
  lead_id UUID,
  file_name VARCHAR(500) NOT NULL,
  file_size BIGINT,
  mime_type VARCHAR(100),
  hash_sha256 VARCHAR(64),
  storage_path TEXT,
  legal_hold BOOLEAN NOT NULL DEFAULT FALSE,
  integrity_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
    CHECK (integrity_status IN ('PENDING', 'VERIFIED', 'TAMPERED', 'MISSING')),
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_evidence_item_case ON evidence_item (case_id);
CREATE INDEX idx_evidence_item_lead ON evidence_item (lead_id);
CREATE INDEX idx_evidence_item_hash ON evidence_item (hash_sha256);
CREATE INDEX idx_evidence_item_legal_hold ON evidence_item (legal_hold) WHERE legal_hold = TRUE;

CREATE TABLE IF NOT EXISTS custody_event (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_id UUID NOT NULL REFERENCES evidence_item(evidence_id),
  action VARCHAR(50) NOT NULL,
  actor_id UUID NOT NULL,
  notes TEXT,
  hash_before VARCHAR(64),
  hash_after VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_custody_event_evidence ON custody_event (evidence_id, created_at DESC);
