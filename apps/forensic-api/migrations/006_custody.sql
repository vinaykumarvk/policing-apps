CREATE TABLE IF NOT EXISTS custody_event (
  event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  evidence_id UUID NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  actor_id UUID REFERENCES user_account(user_id),
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_custody_event_evidence ON custody_event(evidence_id);
