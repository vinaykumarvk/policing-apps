-- FR-06: Low-confidence NEEDS_REVIEW routing
-- FR-10: Alert actions, external sharing

ALTER TABLE classification_result ADD COLUMN IF NOT EXISTS review_status TEXT DEFAULT 'AUTO_ACCEPTED'
  CHECK (review_status IN ('AUTO_ACCEPTED', 'NEEDS_REVIEW', 'REVIEWED', 'AUTO_REJECTED'));
ALTER TABLE classification_result ADD COLUMN IF NOT EXISTS reviewed_by UUID;
ALTER TABLE classification_result ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS alert_share (
  share_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES sm_alert(alert_id),
  shared_with TEXT NOT NULL,
  share_type TEXT NOT NULL CHECK (share_type IN ('INTERNAL', 'EXTERNAL_AGENCY', 'PLATFORM_REPORT')),
  shared_by UUID NOT NULL,
  notes TEXT,
  shared_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_classification_review ON classification_result (review_status) WHERE review_status = 'NEEDS_REVIEW';
CREATE INDEX IF NOT EXISTS idx_alert_share ON alert_share (alert_id);
