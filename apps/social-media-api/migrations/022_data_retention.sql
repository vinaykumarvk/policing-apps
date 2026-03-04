-- Data Retention Framework

CREATE TABLE IF NOT EXISTS data_retention_policy (
  policy_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name    TEXT NOT NULL UNIQUE,
  retention_days INTEGER NOT NULL DEFAULT 365,
  date_column   TEXT NOT NULL DEFAULT 'created_at',
  soft_delete   BOOLEAN NOT NULL DEFAULT true,
  description   TEXT,
  enabled       BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO data_retention_policy (table_name, retention_days, date_column, soft_delete, description)
VALUES
  ('auth_token_denylist', 7, 'expires_at', false, 'Expired token denylist entries'),
  ('notification', 90, 'created_at', false, 'Read notifications older than 90 days'),
  ('audit_log', 2555, 'created_at', false, 'Audit logs — 7 year retention per compliance')
ON CONFLICT (table_name) DO NOTHING;

CREATE OR REPLACE FUNCTION run_data_retention()
RETURNS TABLE(table_name TEXT, rows_deleted BIGINT) AS $$
DECLARE
  pol RECORD;
  del_count BIGINT;
BEGIN
  FOR pol IN
    SELECT p.table_name, p.retention_days, p.date_column, p.soft_delete
    FROM data_retention_policy p
    WHERE p.enabled = true
      AND p.table_name != 'audit_log'
  LOOP
    IF pol.soft_delete THEN
      EXECUTE format(
        'UPDATE %I SET deleted_at = NOW() WHERE %I < NOW() - INTERVAL ''%s days'' AND deleted_at IS NULL',
        pol.table_name, pol.date_column, pol.retention_days
      );
    ELSE
      EXECUTE format(
        'DELETE FROM %I WHERE %I < NOW() - INTERVAL ''%s days''',
        pol.table_name, pol.date_column, pol.retention_days
      );
    END IF;
    GET DIAGNOSTICS del_count = ROW_COUNT;
    table_name := pol.table_name;
    rows_deleted := del_count;
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
