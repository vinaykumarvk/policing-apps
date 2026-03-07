-- FR-12: DOPAMS integration execution — extend sync event with retry and webhook

ALTER TABLE dopams_sync_event ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;
ALTER TABLE dopams_sync_event ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;
ALTER TABLE dopams_sync_event ADD COLUMN IF NOT EXISTS webhook_url TEXT;
ALTER TABLE dopams_sync_event ADD COLUMN IF NOT EXISTS response_code INTEGER;
ALTER TABLE dopams_sync_event ADD COLUMN IF NOT EXISTS response_body TEXT;

CREATE INDEX IF NOT EXISTS idx_dopams_sync_retry ON dopams_sync_event (next_retry_at) WHERE status = 'FAILED' AND next_retry_at IS NOT NULL;
