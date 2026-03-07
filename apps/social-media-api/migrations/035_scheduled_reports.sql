-- 035: Scheduled MIS reports for Social Media

CREATE TABLE IF NOT EXISTS scheduled_report (
  report_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type     VARCHAR(100) NOT NULL,
  report_name     VARCHAR(255) NOT NULL,
  cron_expression VARCHAR(100) NOT NULL,
  last_run_at     TIMESTAMPTZ,
  next_run_at     TIMESTAMPTZ,
  config_jsonb    JSONB DEFAULT '{}',
  is_active       BOOLEAN DEFAULT TRUE,
  created_by      UUID REFERENCES user_account(user_id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_report_active ON scheduled_report (is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_scheduled_report_next_run ON scheduled_report (next_run_at) WHERE is_active = TRUE;
