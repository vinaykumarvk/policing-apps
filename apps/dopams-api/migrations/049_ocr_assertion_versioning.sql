-- FR-03 AC-05: Versioned OCR assertions
CREATE TABLE IF NOT EXISTS ocr_assertion (
  assertion_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_id UUID NOT NULL,
  job_id UUID REFERENCES ocr_job(job_id),
  assertion_text TEXT,
  confidence NUMERIC(5,4) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PENDING',
  assertion_version INTEGER NOT NULL DEFAULT 1,
  previous_assertion_id UUID REFERENCES ocr_assertion(assertion_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ocr_assertion_evidence ON ocr_assertion(evidence_id);
CREATE INDEX IF NOT EXISTS idx_ocr_assertion_version ON ocr_assertion(evidence_id, assertion_version DESC);
