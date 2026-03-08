-- 042: FR-15 AC-05 SIEM forwarding tracking for high-severity alerts

ALTER TABLE sm_alert ADD COLUMN IF NOT EXISTS siem_forwarded_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_sm_alert_siem_pending ON sm_alert (created_at)
  WHERE priority IN ('CRITICAL', 'HIGH') AND siem_forwarded_at IS NULL;
