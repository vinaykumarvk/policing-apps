-- 020_audit_extra_columns.sql
-- Add IP address, request correlation ID, actor role, and response status to audit_log.
-- These columns support audit trail gap analysis and forensic investigations.
-- NOTE: Social-media-api uses "audit_log" (not "audit_event").

-- The immutability rules (no UPDATE / no DELETE) on audit_log block DML but
-- not DDL, so ALTER TABLE ADD COLUMN works without disabling them.

ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS ip_address       TEXT;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS request_id       TEXT;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS actor_role       TEXT;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS response_status  SMALLINT;
