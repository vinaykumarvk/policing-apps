CREATE TABLE IF NOT EXISTS auth_session_activity (
  jti UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_session_activity_user ON auth_session_activity (user_id);

-- Cleanup: remove rows for expired tokens (older than 30 min)
CREATE OR REPLACE FUNCTION cleanup_stale_sessions() RETURNS void AS $$
BEGIN
  DELETE FROM auth_session_activity WHERE last_activity_at < NOW() - INTERVAL '30 minutes';
END;
$$ LANGUAGE plpgsql;
