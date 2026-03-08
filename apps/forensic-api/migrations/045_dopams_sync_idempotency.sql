-- FR-12 AC-03: Idempotency key on DOPAMS sync events
ALTER TABLE dopams_sync_event ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_dopams_sync_idempotency ON dopams_sync_event(case_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

-- FR-11 AC-03: approved_at timestamp on reports
ALTER TABLE report ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
