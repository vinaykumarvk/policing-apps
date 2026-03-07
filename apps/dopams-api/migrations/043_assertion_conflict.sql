CREATE TABLE IF NOT EXISTS assertion_conflict (
  conflict_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id UUID NOT NULL REFERENCES subject_profile(subject_id),
  field_name VARCHAR(64) NOT NULL,
  value_a TEXT NOT NULL,
  source_a VARCHAR(128),
  value_b TEXT NOT NULL,
  source_b VARCHAR(128),
  resolution VARCHAR(16) DEFAULT 'UNRESOLVED',
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_assertion_conflict_subject ON assertion_conflict (subject_id);
CREATE INDEX IF NOT EXISTS idx_assertion_conflict_unresolved ON assertion_conflict (resolution) WHERE resolution = 'UNRESOLVED';
