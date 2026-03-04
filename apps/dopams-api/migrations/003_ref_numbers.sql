-- Reference number sequences and columns
CREATE SEQUENCE IF NOT EXISTS dopams_alert_ref_seq;
ALTER TABLE alert ADD COLUMN IF NOT EXISTS alert_ref TEXT UNIQUE;

CREATE SEQUENCE IF NOT EXISTS dopams_lead_ref_seq;
ALTER TABLE lead ADD COLUMN IF NOT EXISTS lead_ref TEXT UNIQUE;

CREATE SEQUENCE IF NOT EXISTS dopams_subject_ref_seq;
ALTER TABLE subject_profile ADD COLUMN IF NOT EXISTS subject_ref TEXT UNIQUE;

-- dopams_case already has case_number column, add sequence for auto-gen
CREATE SEQUENCE IF NOT EXISTS dopams_case_ref_seq;
