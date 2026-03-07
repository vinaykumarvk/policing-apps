-- FR-02/FR-19: Source connectors, ingestion orchestration, content intake

CREATE TABLE IF NOT EXISTS connector_config (
  connector_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_name TEXT NOT NULL,
  connector_type TEXT NOT NULL CHECK (connector_type IN ('CCTNS', 'ECOURTS', 'NDPS', 'INTELLIGENCE', 'MANUAL')),
  endpoint_url TEXT,
  auth_config JSONB DEFAULT '{}'::jsonb,
  poll_interval_seconds INTEGER DEFAULT 3600,
  is_active BOOLEAN DEFAULT TRUE,
  last_poll_at TIMESTAMPTZ,
  error_count INTEGER DEFAULT 0,
  last_error TEXT,
  health_status TEXT DEFAULT 'UNKNOWN' CHECK (health_status IN ('HEALTHY', 'DEGRADED', 'DOWN', 'UNKNOWN')),
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ingestion_job (
  job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id UUID REFERENCES connector_config(connector_id),
  job_type TEXT NOT NULL CHECK (job_type IN ('FULL_SYNC', 'INCREMENTAL', 'MANUAL_UPLOAD', 'RETRY')),
  state_id TEXT NOT NULL DEFAULT 'QUEUED' CHECK (state_id IN ('QUEUED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'PARTIAL')),
  row_version INTEGER DEFAULT 1,
  total_records INTEGER DEFAULT 0,
  processed_records INTEGER DEFAULT 0,
  failed_records INTEGER DEFAULT 0,
  error_message TEXT,
  warnings JSONB DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE INDEX IF NOT EXISTS idx_ingestion_job_state ON ingestion_job (state_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_job_connector ON ingestion_job (connector_id);
CREATE INDEX IF NOT EXISTS idx_connector_dead_letter_source ON connector_dead_letter (source, failed_at DESC);
