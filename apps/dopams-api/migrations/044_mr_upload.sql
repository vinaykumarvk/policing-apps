CREATE TABLE IF NOT EXISTS mr_upload (
  file_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_name VARCHAR(256) NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  uploaded_by UUID,
  processing_status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  error_message TEXT,
  started_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mr_upload_status ON mr_upload (processing_status);
