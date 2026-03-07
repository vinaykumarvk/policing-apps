-- FR-13: Alert rules engine, lifecycle states, assignment, SLA

-- Migrate alert from simple is_read to full lifecycle
ALTER TABLE alert ADD COLUMN IF NOT EXISTS state_id TEXT DEFAULT 'NEW';
ALTER TABLE alert ADD COLUMN IF NOT EXISTS row_version INTEGER DEFAULT 1;
ALTER TABLE alert ADD COLUMN IF NOT EXISTS assigned_to UUID;
ALTER TABLE alert ADD COLUMN IF NOT EXISTS sla_due_at TIMESTAMPTZ;
ALTER TABLE alert ADD COLUMN IF NOT EXISTS resolution_notes TEXT;
ALTER TABLE alert ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;
ALTER TABLE alert ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

-- Alert rules engine
CREATE TABLE IF NOT EXISTS alert_rule (
  rule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  event_type TEXT NOT NULL,
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  alert_type TEXT NOT NULL DEFAULT 'RULE_TRIGGERED',
  severity TEXT DEFAULT 'MEDIUM' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  sla_hours INTEGER DEFAULT 24,
  auto_assign_role TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_state ON alert (state_id);
CREATE INDEX IF NOT EXISTS idx_alert_assigned ON alert (assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_alert_sla ON alert (sla_due_at) WHERE sla_due_at IS NOT NULL AND state_id NOT IN ('RESOLVED', 'DISMISSED');
CREATE INDEX IF NOT EXISTS idx_alert_rule_entity ON alert_rule (entity_type, event_type) WHERE is_active = TRUE;
