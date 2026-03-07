-- FR-24: Hierarchical escalation rules for notifications
ALTER TABLE notification_rule ADD COLUMN IF NOT EXISTS escalation_level INTEGER DEFAULT 1;
ALTER TABLE notification_rule ADD COLUMN IF NOT EXISTS escalation_timeout_minutes INTEGER DEFAULT 60;
ALTER TABLE notification_rule ADD COLUMN IF NOT EXISTS escalated_from_id UUID REFERENCES notification_rule(rule_id);

CREATE INDEX IF NOT EXISTS idx_notification_rule_escalation ON notification_rule (escalation_level)
  WHERE is_active = TRUE;
