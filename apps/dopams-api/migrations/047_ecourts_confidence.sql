-- FR-06: E-Courts match confidence scoring and ambiguous routing
ALTER TABLE court_case ADD COLUMN IF NOT EXISTS confidence_score NUMERIC(5,4);
ALTER TABLE court_case ADD COLUMN IF NOT EXISTS review_status VARCHAR(20) DEFAULT 'AUTO_MATCHED'
  CHECK (review_status IN ('AUTO_MATCHED', 'AMBIGUOUS', 'MANUAL_CONFIRMED', 'MANUAL_REJECTED'));

CREATE INDEX IF NOT EXISTS idx_court_case_review_status ON court_case (review_status)
  WHERE review_status = 'AMBIGUOUS';
