-- FR-14 AC-03: Permission set JSON on user_role
ALTER TABLE user_role ADD COLUMN IF NOT EXISTS permission_set_json JSONB;
