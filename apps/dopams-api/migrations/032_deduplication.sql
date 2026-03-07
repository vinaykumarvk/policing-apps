-- FR-25: Subject deduplication, merge, survivorship

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS dedup_candidate (
  candidate_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id_a UUID NOT NULL REFERENCES subject_profile(subject_id),
  subject_id_b UUID NOT NULL REFERENCES subject_profile(subject_id),
  similarity_score NUMERIC(5,4) NOT NULL,
  match_fields JSONB DEFAULT '[]'::jsonb,
  state_id TEXT DEFAULT 'PENDING' CHECK (state_id IN ('PENDING', 'CONFIRMED', 'REJECTED', 'MERGED')),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (subject_id_a, subject_id_b)
);

CREATE TABLE IF NOT EXISTS merge_history (
  merge_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survivor_id UUID NOT NULL REFERENCES subject_profile(subject_id),
  merged_id UUID NOT NULL REFERENCES subject_profile(subject_id),
  field_decisions JSONB NOT NULL DEFAULT '{}'::jsonb,
  merged_by UUID NOT NULL,
  merged_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigram index for fuzzy name matching
CREATE INDEX IF NOT EXISTS idx_subject_name_trgm ON subject_profile USING gin (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_dedup_candidate_state ON dedup_candidate (state_id);
CREATE INDEX IF NOT EXISTS idx_dedup_candidate_score ON dedup_candidate (similarity_score DESC);
CREATE INDEX IF NOT EXISTS idx_merge_history_survivor ON merge_history (survivor_id);
