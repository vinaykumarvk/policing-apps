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
ALTER TABLE forensic_case ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES organization_unit(unit_id);
ALTER TABLE evidence_source ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES organization_unit(unit_id);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_forensic_case_unit ON forensic_case(unit_id);
CREATE INDEX IF NOT EXISTS idx_evidence_source_unit ON evidence_source(unit_id);
