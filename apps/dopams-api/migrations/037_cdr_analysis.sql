-- FR-12: CDR analysis, route mapping, stay location detection

-- Tower location reference
CREATE TABLE IF NOT EXISTS tower_location (
  tower_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tower_code TEXT NOT NULL UNIQUE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  address TEXT,
  operator TEXT,
  sector_count INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CDR records
CREATE TABLE IF NOT EXISTS cdr_record (
  cdr_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID REFERENCES subject_profile(subject_id),
  calling_number TEXT NOT NULL,
  called_number TEXT NOT NULL,
  call_type TEXT CHECK (call_type IN ('VOICE', 'SMS', 'DATA', 'MMS')) DEFAULT 'VOICE',
  call_start TIMESTAMPTZ NOT NULL,
  call_end TIMESTAMPTZ,
  duration_seconds INTEGER DEFAULT 0,
  calling_tower_id UUID REFERENCES tower_location(tower_id),
  called_tower_id UUID REFERENCES tower_location(tower_id),
  imei TEXT,
  imsi TEXT,
  source_file TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stay locations (derived from CDR clustering)
CREATE TABLE IF NOT EXISTS stay_location (
  stay_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES subject_profile(subject_id),
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  radius_meters DOUBLE PRECISION DEFAULT 500,
  stay_start TIMESTAMPTZ NOT NULL,
  stay_end TIMESTAMPTZ NOT NULL,
  tower_ids UUID[] DEFAULT '{}',
  cdr_count INTEGER DEFAULT 0,
  label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Async analysis jobs
CREATE TABLE IF NOT EXISTS analysis_job (
  job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL CHECK (job_type IN ('CDR_ANALYSIS', 'ROUTE_MAP', 'STAY_DETECTION', 'GRAPH_ANALYSIS')),
  subject_id UUID,
  parameters JSONB DEFAULT '{}'::jsonb,
  state_id TEXT NOT NULL DEFAULT 'QUEUED' CHECK (state_id IN ('QUEUED', 'IN_PROGRESS', 'COMPLETED', 'FAILED')),
  result JSONB,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cdr_subject ON cdr_record (subject_id);
CREATE INDEX IF NOT EXISTS idx_cdr_calling ON cdr_record (calling_number);
CREATE INDEX IF NOT EXISTS idx_cdr_called ON cdr_record (called_number);
CREATE INDEX IF NOT EXISTS idx_cdr_time ON cdr_record (call_start);
CREATE INDEX IF NOT EXISTS idx_stay_subject ON stay_location (subject_id);
CREATE INDEX IF NOT EXISTS idx_analysis_job_state ON analysis_job (state_id) WHERE state_id IN ('QUEUED', 'IN_PROGRESS');
