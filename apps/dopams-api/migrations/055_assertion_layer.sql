-- Migration 055: Assertion Layer
-- Per-field multi-source provenance with trust ranking, conflict detection, and reviewer workflow
-- Replaces single field_provenance JSONB blob (FR-04 AC-02)

-- Source trust configuration — editable trust rankings per source system
CREATE TABLE IF NOT EXISTS source_trust_config (
  source_system  VARCHAR(50) PRIMARY KEY,
  trust_rank     SMALLINT NOT NULL CHECK (trust_rank BETWEEN 1 AND 5),
  description    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default trust rankings
INSERT INTO source_trust_config (source_system, trust_rank, description) VALUES
  ('CCTNS',          5, 'Crime and Criminal Tracking Network — authoritative government source'),
  ('ECOURTS',        4, 'eCourts judicial records — court-verified data'),
  ('NDPS',           4, 'NDPS Act records — statutory drug offence data'),
  ('CDR',            3, 'Call Detail Records — telecom operator data'),
  ('FINANCIAL',      3, 'Financial intelligence — bank/UPI transaction data'),
  ('MANUAL',         2, 'Manual entry by officer — field-collected data'),
  ('AI_EXTRACTION',  1, 'AI/ML extracted data — requires human review')
ON CONFLICT (source_system) DO NOTHING;

-- Subject assertion — append-only provenance table
-- Each row represents a single attribute value claimed by a source
CREATE TABLE IF NOT EXISTS subject_assertion (
  assertion_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id         UUID NOT NULL REFERENCES subject_profile(subject_id) ON DELETE CASCADE,
  attribute_name     VARCHAR(100) NOT NULL,
  attribute_value    TEXT NOT NULL,
  source_document_id UUID,
  source_system      VARCHAR(50) NOT NULL REFERENCES source_trust_config(source_system),
  confidence_score   NUMERIC(5,2) CHECK (confidence_score BETWEEN 0 AND 100),
  source_trust_rank  SMALLINT NOT NULL CHECK (source_trust_rank BETWEEN 1 AND 5),
  review_status      VARCHAR(20) NOT NULL DEFAULT 'AUTO_PROPOSED'
    CHECK (review_status IN ('AUTO_PROPOSED', 'REVIEWED', 'APPROVED', 'REJECTED', 'CONFLICTING', 'NOT_AVAILABLE')),
  reviewed_by        UUID,
  reviewed_at        TIMESTAMPTZ,
  effective_from     DATE,
  effective_to       DATE,
  is_current         BOOLEAN NOT NULL DEFAULT TRUE,
  superseded_by      UUID REFERENCES subject_assertion(assertion_id),
  created_by         UUID NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_assertion_subject ON subject_assertion(subject_id);
CREATE INDEX IF NOT EXISTS idx_assertion_subject_attr ON subject_assertion(subject_id, attribute_name);
CREATE INDEX IF NOT EXISTS idx_assertion_current ON subject_assertion(subject_id, attribute_name, is_current) WHERE is_current = TRUE;
CREATE INDEX IF NOT EXISTS idx_assertion_review ON subject_assertion(review_status) WHERE review_status IN ('AUTO_PROPOSED', 'CONFLICTING');
CREATE INDEX IF NOT EXISTS idx_assertion_source ON subject_assertion(source_system);
