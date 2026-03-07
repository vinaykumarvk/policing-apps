-- 036: FR-02 Permission Level Enforcement
-- PL0-PL4 permission levels with differentiated session timeouts

ALTER TABLE role ADD COLUMN IF NOT EXISTS permission_level INTEGER DEFAULT 0;
ALTER TABLE role ADD COLUMN IF NOT EXISTS session_timeout_minutes INTEGER DEFAULT 30;

-- Set default permission levels for existing roles
UPDATE role SET permission_level = 0, session_timeout_minutes = 5 WHERE role_key = 'PLATFORM_ADMINISTRATOR';
UPDATE role SET permission_level = 1, session_timeout_minutes = 15 WHERE role_key = 'SUPERVISOR';
UPDATE role SET permission_level = 2, session_timeout_minutes = 30 WHERE role_key IN ('INVESTIGATOR', 'LEGAL_REVIEWER', 'EVIDENCE_CUSTODIAN');
UPDATE role SET permission_level = 3, session_timeout_minutes = 60 WHERE role_key IN ('INTELLIGENCE_ANALYST', 'CONTROL_ROOM_OPERATOR');

CREATE INDEX IF NOT EXISTS idx_role_permission_level ON role (permission_level);
