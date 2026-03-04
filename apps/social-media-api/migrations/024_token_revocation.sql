CREATE TABLE IF NOT EXISTS auth_token_denylist (
  jti UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES user_account(user_id),
  revoked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_token_denylist_expires ON auth_token_denylist (expires_at);

-- Cleanup function for expired entries
CREATE OR REPLACE FUNCTION cleanup_expired_tokens() RETURNS void AS $$
BEGIN
  DELETE FROM auth_token_denylist WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- User-level revocation: revoke all tokens issued before this timestamp
ALTER TABLE user_account ADD COLUMN IF NOT EXISTS tokens_revoked_before TIMESTAMPTZ;
