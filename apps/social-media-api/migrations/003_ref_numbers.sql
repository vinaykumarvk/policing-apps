-- Reference number sequences and columns
CREATE SEQUENCE IF NOT EXISTS sm_alert_ref_seq;
ALTER TABLE sm_alert ADD COLUMN IF NOT EXISTS alert_ref TEXT UNIQUE;

CREATE SEQUENCE IF NOT EXISTS sm_case_ref_seq;
ALTER TABLE case_record ADD COLUMN IF NOT EXISTS case_ref TEXT UNIQUE;

CREATE SEQUENCE IF NOT EXISTS sm_evidence_ref_seq;
ALTER TABLE evidence_item ADD COLUMN IF NOT EXISTS evidence_ref TEXT UNIQUE;

CREATE SEQUENCE IF NOT EXISTS sm_report_ref_seq;
ALTER TABLE report_instance ADD COLUMN IF NOT EXISTS report_ref TEXT UNIQUE;
