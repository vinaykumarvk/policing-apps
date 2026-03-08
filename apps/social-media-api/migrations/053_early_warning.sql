-- Migration 053: Early Warning System (UNODC EWA)
-- Detection trends, spike alerts, NPS candidates, shared trend snapshots

-- Detection trend table (hourly buckets)
CREATE TABLE IF NOT EXISTS detection_trend (
  trend_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  term_type TEXT NOT NULL,
  term_value TEXT NOT NULL,
  category TEXT,
  time_bucket TIMESTAMPTZ NOT NULL,
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  unit_id UUID REFERENCES organization_unit(unit_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_detection_trend_unique
  ON detection_trend(term_type, term_value, time_bucket, unit_id);
CREATE INDEX IF NOT EXISTS idx_detection_trend_bucket ON detection_trend(time_bucket DESC);

-- Trend spike alert table
CREATE TABLE IF NOT EXISTS trend_spike_alert (
  spike_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  term_type TEXT NOT NULL,
  term_value TEXT NOT NULL,
  baseline_count NUMERIC NOT NULL,
  spike_count INTEGER NOT NULL,
  spike_ratio NUMERIC NOT NULL,
  time_window TEXT NOT NULL DEFAULT '1h',
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_by UUID REFERENCES user_account(user_id),
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trend_spike_unacked ON trend_spike_alert(acknowledged) WHERE acknowledged = FALSE;

-- NPS (New Psychoactive Substance) candidate table
CREATE TABLE IF NOT EXISTS nps_candidate (
  nps_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  term TEXT NOT NULL,
  context_snippet TEXT,
  source_content_ids UUID[] DEFAULT '{}',
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED_NPS', 'FALSE_POSITIVE', 'KNOWN_SUBSTANCE')),
  reviewed_by UUID REFERENCES user_account(user_id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nps_candidate_status ON nps_candidate(status);

-- Shared trend snapshot table (cross-jurisdiction)
CREATE TABLE IF NOT EXISTS shared_trend_snapshot (
  snapshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_unit_id UUID NOT NULL REFERENCES organization_unit(unit_id),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  trend_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shared_trend_period ON shared_trend_snapshot(period_start DESC);
