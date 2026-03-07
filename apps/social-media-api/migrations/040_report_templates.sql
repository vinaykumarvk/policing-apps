-- 040: FR-13 Report Template CRUD
-- Enhance report_template table with additional fields

ALTER TABLE report_template ADD COLUMN IF NOT EXISTS content_schema JSONB DEFAULT '{}';
ALTER TABLE report_template ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES user_account(user_id);
ALTER TABLE report_template ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE report_template ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_report_template_active ON report_template (is_active) WHERE is_active = TRUE AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_report_template_type ON report_template (template_type);
