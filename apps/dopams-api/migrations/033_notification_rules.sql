-- FR-24: Auto-trigger notification rules, email relay, snooze

CREATE TABLE IF NOT EXISTS notification_rule (
  rule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  event_type TEXT NOT NULL,
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  recipient_role TEXT,
  recipient_user_id UUID,
  channel TEXT DEFAULT 'IN_APP' CHECK (channel IN ('IN_APP', 'EMAIL', 'SMS', 'PUSH')),
  template TEXT NOT NULL,
  priority TEXT DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'CRITICAL')),
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notification ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ;
ALTER TABLE notification ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'IN_APP';
ALTER TABLE notification ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'PENDING'
  CHECK (delivery_status IN ('PENDING', 'DELIVERED', 'FAILED', 'SNOOZED'));
ALTER TABLE notification ADD COLUMN IF NOT EXISTS rule_id UUID REFERENCES notification_rule(rule_id);

CREATE INDEX IF NOT EXISTS idx_notification_rule_entity ON notification_rule (entity_type, event_type) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_notification_snoozed ON notification (snoozed_until) WHERE snoozed_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notification_delivery ON notification (delivery_status);
