ALTER TABLE dopams_sync_event ADD COLUMN IF NOT EXISTS correlation_id VARCHAR(128);
CREATE INDEX IF NOT EXISTS idx_dopams_sync_correlation ON dopams_sync_event (correlation_id) WHERE correlation_id IS NOT NULL;
