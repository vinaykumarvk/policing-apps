-- FR-03: Exponential backoff, dead-letter queue, connector health

ALTER TABLE source_connector ADD COLUMN IF NOT EXISTS error_count INTEGER DEFAULT 0;
ALTER TABLE source_connector ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE source_connector ADD COLUMN IF NOT EXISTS health_status TEXT DEFAULT 'UNKNOWN'
  CHECK (health_status IN ('HEALTHY', 'DEGRADED', 'DOWN', 'UNKNOWN'));
ALTER TABLE source_connector ADD COLUMN IF NOT EXISTS backoff_until TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS connector_dead_letter (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT NOT NULL,
  source TEXT NOT NULL,
  connector_name TEXT NOT NULL,
  raw_data JSONB NOT NULL,
  error_message TEXT NOT NULL,
  retry_count INTEGER DEFAULT 0,
  failed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (external_id, source)
);

CREATE INDEX IF NOT EXISTS idx_connector_dead_letter_source ON connector_dead_letter (source, failed_at DESC);
CREATE INDEX IF NOT EXISTS idx_connector_health ON source_connector (health_status) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_connector_backoff ON source_connector (backoff_until) WHERE backoff_until IS NOT NULL;
