-- SM already has notification_event table, add index for unread lookups
CREATE INDEX IF NOT EXISTS idx_notification_user_unread ON notification_event(user_id, is_read) WHERE is_read = FALSE;
