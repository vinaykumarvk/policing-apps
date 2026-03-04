CREATE TABLE IF NOT EXISTS notification (
  notification_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_account(user_id),
  type VARCHAR(64) NOT NULL DEFAULT 'INFO',
  title VARCHAR(256) NOT NULL,
  message TEXT,
  entity_type VARCHAR(64),
  entity_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notification_user_unread ON notification(user_id, is_read) WHERE is_read = FALSE;
