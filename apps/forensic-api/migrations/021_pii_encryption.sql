-- PII Field-Level Encryption
-- Uses pgcrypto symmetric encryption (pgp_sym_encrypt/decrypt) for sensitive JSONB fields.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION pii_encrypt(plaintext TEXT, enc_key TEXT)
RETURNS BYTEA AS $$
BEGIN
  IF plaintext IS NULL THEN RETURN NULL; END IF;
  RETURN pgp_sym_encrypt(plaintext, enc_key);
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT;

CREATE OR REPLACE FUNCTION pii_decrypt(ciphertext BYTEA, enc_key TEXT)
RETURNS TEXT AS $$
BEGIN
  IF ciphertext IS NULL THEN RETURN NULL; END IF;
  RETURN pgp_sym_decrypt(ciphertext, enc_key);
EXCEPTION WHEN OTHERS THEN
  RETURN '[DECRYPTION_FAILED]';
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT;

-- user_account: email and phone are PII
ALTER TABLE user_account
  ADD COLUMN IF NOT EXISTS email_enc BYTEA,
  ADD COLUMN IF NOT EXISTS phone_enc BYTEA;
