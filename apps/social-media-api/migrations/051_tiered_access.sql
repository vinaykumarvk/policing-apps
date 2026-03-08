-- Migration 051: Tiered Access & Oversight (NCORD 4-tier model)
-- Adds tier hierarchy, SLA rules, escalation fields

-- Tier level for organization units
ALTER TABLE organization_unit ADD COLUMN IF NOT EXISTS tier_level TEXT CHECK (tier_level IN ('NATIONAL', 'STATE', 'DISTRICT', 'LOCAL'));

-- SLA rule table
CREATE TABLE IF NOT EXISTS sla_rule (
  rule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  priority TEXT NOT NULL,
  category TEXT,
  entity_type TEXT NOT NULL DEFAULT 'sm_alert',
  sla_minutes INTEGER NOT NULL,
  escalate_to_parent BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed SLA rules
INSERT INTO sla_rule (priority, entity_type, sla_minutes, escalate_to_parent) VALUES
  ('CRITICAL', 'sm_alert', 60, TRUE),
  ('HIGH', 'sm_alert', 240, TRUE),
  ('MEDIUM', 'sm_alert', 1440, TRUE),
  ('LOW', 'sm_alert', 4320, FALSE)
ON CONFLICT DO NOTHING;

-- Alert escalation fields
ALTER TABLE sm_alert ADD COLUMN IF NOT EXISTS escalated_from_unit_id UUID REFERENCES organization_unit(unit_id);
ALTER TABLE sm_alert ADD COLUMN IF NOT EXISTS escalation_level INTEGER DEFAULT 0;
ALTER TABLE sm_alert ADD COLUMN IF NOT EXISTS escalation_reason TEXT;
ALTER TABLE sm_alert ADD COLUMN IF NOT EXISTS pending_approval BOOLEAN DEFAULT FALSE;
ALTER TABLE sm_alert ADD COLUMN IF NOT EXISTS approval_requested_by UUID REFERENCES user_account(user_id);
ALTER TABLE sm_alert ADD COLUMN IF NOT EXISTS approval_requested_at TIMESTAMPTZ;
ALTER TABLE sm_alert ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES user_account(user_id);
ALTER TABLE sm_alert ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- Hierarchy traversal function
CREATE OR REPLACE FUNCTION get_ancestor_unit_ids(start_unit_id UUID)
RETURNS UUID[] AS $$
DECLARE
  result UUID[] := ARRAY[start_unit_id];
  current_id UUID := start_unit_id;
  parent UUID;
BEGIN
  LOOP
    SELECT parent_unit_id INTO parent FROM organization_unit WHERE unit_id = current_id;
    EXIT WHEN parent IS NULL OR parent = current_id;
    result := result || parent;
    current_id := parent;
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;
