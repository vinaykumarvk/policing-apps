-- Add organization_unit table
CREATE TABLE IF NOT EXISTS organization_unit (
  unit_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(256) NOT NULL,
  code          VARCHAR(64) UNIQUE NOT NULL,
  parent_unit_id UUID REFERENCES organization_unit(unit_id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add unit_id to user_account
ALTER TABLE user_account ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES organization_unit(unit_id);

-- Add unit_id to entity tables
ALTER TABLE alert ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES organization_unit(unit_id);
ALTER TABLE lead ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES organization_unit(unit_id);
ALTER TABLE dopams_case ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES organization_unit(unit_id);
ALTER TABLE subject_profile ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES organization_unit(unit_id);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_alert_unit ON alert(unit_id);
CREATE INDEX IF NOT EXISTS idx_lead_unit ON lead(unit_id);
CREATE INDEX IF NOT EXISTS idx_dopams_case_unit ON dopams_case(unit_id);
CREATE INDEX IF NOT EXISTS idx_subject_profile_unit ON subject_profile(unit_id);
