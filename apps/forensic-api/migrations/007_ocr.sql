-- OCR Pipeline (Tier 3A)
CREATE TABLE IF NOT EXISTS ocr_job (
  job_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_id   UUID NOT NULL REFERENCES evidence_source(evidence_id),
  status        TEXT NOT NULL DEFAULT 'PENDING'
                  CHECK (status IN ('PENDING','PROCESSING','COMPLETED','FAILED')),
  result_text   TEXT,
  language      TEXT DEFAULT 'eng',
  confidence    NUMERIC(5,2),
  error_message TEXT,
  created_by    UUID,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ocr_job_evidence ON ocr_job(evidence_id);
CREATE INDEX IF NOT EXISTS idx_ocr_job_status   ON ocr_job(status);
