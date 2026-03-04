-- Multi-Factor Authentication (TOTP)
-- Adds MFA capability to user accounts using TOTP (RFC 6238).

ALTER TABLE user_account
  ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mfa_secret_enc BYTEA,
  ADD COLUMN IF NOT EXISTS mfa_backup_codes_enc BYTEA,
  ADD COLUMN IF NOT EXISTS mfa_enrolled_at TIMESTAMPTZ;
