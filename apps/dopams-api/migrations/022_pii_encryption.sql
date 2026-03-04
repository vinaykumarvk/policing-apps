-- PII Field-Level Encryption
-- Uses pgcrypto symmetric encryption (pgp_sym_encrypt/decrypt) for sensitive JSONB fields.
-- The encryption key is passed at query time from the application layer via a session variable.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Helper function: encrypt a TEXT value using the session-level encryption key
CREATE OR REPLACE FUNCTION pii_encrypt(plaintext TEXT, enc_key TEXT)
RETURNS BYTEA AS $$
BEGIN
  IF plaintext IS NULL THEN RETURN NULL; END IF;
  RETURN pgp_sym_encrypt(plaintext, enc_key);
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT;

-- Helper function: decrypt a BYTEA value using the session-level encryption key
CREATE OR REPLACE FUNCTION pii_decrypt(ciphertext BYTEA, enc_key TEXT)
RETURNS TEXT AS $$
BEGIN
  IF ciphertext IS NULL THEN RETURN NULL; END IF;
  RETURN pgp_sym_decrypt(ciphertext, enc_key);
EXCEPTION WHEN OTHERS THEN
  RETURN '[DECRYPTION_FAILED]';
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT;

-- Add encrypted columns alongside existing plaintext columns
-- We keep the original columns temporarily for migration, then drop them

-- subject_profile: identifiers and addresses are PII
ALTER TABLE subject_profile
  ADD COLUMN IF NOT EXISTS identifiers_enc BYTEA,
  ADD COLUMN IF NOT EXISTS addresses_enc BYTEA;

-- user_account: email and phone are PII
ALTER TABLE user_account
  ADD COLUMN IF NOT EXISTS email_enc BYTEA,
  ADD COLUMN IF NOT EXISTS phone_enc BYTEA;

-- Note: To complete the migration, the application must:
-- 1. Set PII_ENCRYPTION_KEY env var
-- 2. Run a one-time script to encrypt existing plaintext data into *_enc columns
-- 3. After verification, drop the plaintext columns
-- This is left as a two-phase migration to avoid data loss.
