-- Memo reference number sequence
CREATE SEQUENCE IF NOT EXISTS dopams_memo_ref_seq;

-- Align memo default state with workflow definition
ALTER TABLE memo ALTER COLUMN state_id SET DEFAULT 'DRAFTED';
