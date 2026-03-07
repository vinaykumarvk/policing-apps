ALTER TABLE role ADD COLUMN IF NOT EXISTS permission_set JSONB DEFAULT '[]'::jsonb;
COMMENT ON COLUMN role.permission_set IS 'JSON array of fine-grained permissions for this role';
