-- 020_audit_extra_columns.sql
-- Add IP address, request correlation ID, actor role, and response status to audit_event.
-- These columns support audit trail gap analysis and forensic investigations.

-- The immutability rules (no UPDATE / no DELETE) on audit_event block DML but
-- not DDL, so ALTER TABLE ADD COLUMN works without disabling them.

ALTER TABLE audit_event ADD COLUMN IF NOT EXISTS ip_address       TEXT;
ALTER TABLE audit_event ADD COLUMN IF NOT EXISTS request_id       TEXT;
ALTER TABLE audit_event ADD COLUMN IF NOT EXISTS actor_role       TEXT;
ALTER TABLE audit_event ADD COLUMN IF NOT EXISTS response_status  SMALLINT;
