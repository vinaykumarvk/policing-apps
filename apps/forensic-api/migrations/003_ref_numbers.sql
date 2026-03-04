-- Reference number sequences
-- forensic_case already has case_number column, add sequence for auto-gen
CREATE SEQUENCE IF NOT EXISTS forensic_case_ref_seq;

CREATE SEQUENCE IF NOT EXISTS forensic_evidence_ref_seq;
ALTER TABLE evidence_source ADD COLUMN IF NOT EXISTS evidence_ref TEXT UNIQUE;

CREATE SEQUENCE IF NOT EXISTS forensic_report_ref_seq;
ALTER TABLE report ADD COLUMN IF NOT EXISTS report_ref TEXT UNIQUE;
