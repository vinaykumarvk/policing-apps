-- FR-07: Add CRITICAL priority band
-- FR-08: Add version, effective_date to statute_library
-- FR-12: Add due_at, closure_reason, closed_at to case_record
-- FR-10: Add due_at to sm_alert

-- Alert SLA field
ALTER TABLE sm_alert ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ;

-- Case closure and SLA fields
ALTER TABLE case_record ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ;
ALTER TABLE case_record ADD COLUMN IF NOT EXISTS closure_reason TEXT;
ALTER TABLE case_record ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

-- Statute versioning
ALTER TABLE statute_library ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE statute_library ADD COLUMN IF NOT EXISTS effective_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE statute_library ADD COLUMN IF NOT EXISTS superseded_by UUID REFERENCES statute_library(statute_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_alert_due_at ON sm_alert (due_at) WHERE due_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_case_due_at ON case_record (due_at) WHERE due_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_case_closed_at ON case_record (closed_at) WHERE closed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_statute_effective ON statute_library (effective_date, is_active);
