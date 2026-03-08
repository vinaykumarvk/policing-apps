CREATE TABLE IF NOT EXISTS notification_email_log (
  email_log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient VARCHAR(256) NOT NULL,
  subject VARCHAR(512) NOT NULL,
  body TEXT,
  status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email_log_status ON notification_email_log (status) WHERE status != 'SENT';
