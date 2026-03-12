-- 060: Add missing columns referenced by dashboard queries

-- organization_unit.is_active — used in district comparison, geo, heatmap queries
ALTER TABLE organization_unit ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- alert.due_at — used in control-room SLA countdown and breach detection
ALTER TABLE alert ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ;

-- subject_profile.is_active — used in top-risk-subjects analytics query
ALTER TABLE subject_profile ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_alert_due_at ON alert(due_at) WHERE due_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_org_unit_active ON organization_unit(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_subject_profile_active ON subject_profile(is_active) WHERE is_active = TRUE;
