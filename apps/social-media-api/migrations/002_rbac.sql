-- Add unit_id to entity tables for jurisdiction scoping
ALTER TABLE sm_alert ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES organization_unit(unit_id);
ALTER TABLE case_record ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES organization_unit(unit_id);
ALTER TABLE evidence_item ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES organization_unit(unit_id);
ALTER TABLE report_instance ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES organization_unit(unit_id);

CREATE INDEX IF NOT EXISTS idx_sm_alert_unit ON sm_alert(unit_id);
CREATE INDEX IF NOT EXISTS idx_case_record_unit ON case_record(unit_id);
CREATE INDEX IF NOT EXISTS idx_evidence_unit ON evidence_item(unit_id);
CREATE INDEX IF NOT EXISTS idx_report_unit ON report_instance(unit_id);
