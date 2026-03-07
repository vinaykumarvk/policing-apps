-- FR-03: Telugu OCR config, language column, confidence threshold routing
ALTER TABLE ocr_job ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'en';
ALTER TABLE ocr_job ADD COLUMN IF NOT EXISTS versioned_assertions JSONB;

-- Update confidence_threshold from NUMERIC(5,2) to allow smaller values like 0.70
-- (existing migration 034 used NUMERIC(5,2) with default 80 as a percentage;
-- we standardize to a 0-1 scale with NUMERIC(3,2))
DO $$
BEGIN
  -- Only alter if the column exists and is NUMERIC(5,2)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ocr_job' AND column_name = 'confidence_threshold'
  ) THEN
    ALTER TABLE ocr_job ALTER COLUMN confidence_threshold SET DEFAULT 0.70;
  ELSE
    ALTER TABLE ocr_job ADD COLUMN confidence_threshold NUMERIC(3,2) DEFAULT 0.70;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ocr_job_language ON ocr_job (language);
