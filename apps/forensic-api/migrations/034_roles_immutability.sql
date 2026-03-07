-- FR-14: Expand from 4 to 8 roles
-- FR-01: Mandatory field validation, closed-case immutability
-- FR-17: Legal hold, archive workflow, purge approval

-- Add new roles
INSERT INTO role (role_key, display_name, description) VALUES
  ('CASE_MANAGER', 'Case Manager', 'Manages case assignments and workflows'),
  ('QUALITY_ASSURANCE', 'Quality Assurance', 'Reviews and validates forensic analysis quality'),
  ('LEGAL_REVIEWER', 'Legal Reviewer', 'Reviews legal mappings and compliance'),
  ('EXTERNAL_PARTNER', 'External Partner', 'External agency partner with limited access'),
  ('AUDIT_OBSERVER', 'Audit Observer', 'Read-only audit and compliance monitoring')
ON CONFLICT (role_key) DO NOTHING;

-- Data lifecycle fields on forensic_case
ALTER TABLE forensic_case ADD COLUMN IF NOT EXISTS legal_hold_status TEXT DEFAULT 'NONE'
  CHECK (legal_hold_status IN ('NONE', 'ACTIVE', 'RELEASED'));
ALTER TABLE forensic_case ADD COLUMN IF NOT EXISTS legal_hold_by UUID;
ALTER TABLE forensic_case ADD COLUMN IF NOT EXISTS legal_hold_at TIMESTAMPTZ;
ALTER TABLE forensic_case ADD COLUMN IF NOT EXISTS legal_hold_reason TEXT;
ALTER TABLE forensic_case ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE forensic_case ADD COLUMN IF NOT EXISTS purge_requested_by UUID;
ALTER TABLE forensic_case ADD COLUMN IF NOT EXISTS purge_requested_at TIMESTAMPTZ;
ALTER TABLE forensic_case ADD COLUMN IF NOT EXISTS purge_approved_by UUID;
ALTER TABLE forensic_case ADD COLUMN IF NOT EXISTS purge_approved_at TIMESTAMPTZ;

-- Trigger to prevent mutation of closed cases (except legal hold operations)
CREATE OR REPLACE FUNCTION prevent_closed_case_mutation() RETURNS trigger AS $$
BEGIN
  IF OLD.state_id IN ('CLOSED', 'ARCHIVED') AND NEW.state_id = OLD.state_id THEN
    -- Allow legal_hold_status changes even on closed cases
    IF NEW.legal_hold_status IS DISTINCT FROM OLD.legal_hold_status THEN
      RETURN NEW;
    END IF;
    -- Allow purge fields
    IF NEW.purge_requested_by IS DISTINCT FROM OLD.purge_requested_by OR
       NEW.purge_approved_by IS DISTINCT FROM OLD.purge_approved_by THEN
      RETURN NEW;
    END IF;
    -- Allow archived_at
    IF NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Cannot modify closed or archived case %', OLD.case_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_closed_case_mutation ON forensic_case;
CREATE TRIGGER trg_prevent_closed_case_mutation
  BEFORE UPDATE ON forensic_case
  FOR EACH ROW
  EXECUTE FUNCTION prevent_closed_case_mutation();

CREATE INDEX IF NOT EXISTS idx_case_legal_hold ON forensic_case (legal_hold_status) WHERE legal_hold_status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_case_archived ON forensic_case (archived_at) WHERE archived_at IS NOT NULL;
