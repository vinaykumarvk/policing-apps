CREATE SCHEMA IF NOT EXISTS platform;

CREATE TABLE IF NOT EXISTS platform.platform_case (
  case_id TEXT PRIMARY KEY,
  source_system TEXT NOT NULL,
  source_record_id TEXT NOT NULL,
  case_number TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  status TEXT NOT NULL,
  source_status TEXT NOT NULL,
  classification TEXT NOT NULL,
  org_id TEXT NOT NULL,
  unit_id TEXT,
  jurisdiction JSONB NOT NULL,
  assignment JSONB NOT NULL,
  field_classification JSONB NOT NULL,
  redaction_profile TEXT NOT NULL,
  redacted_fields TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  legal_hold_status TEXT NOT NULL,
  retention_status TEXT NOT NULL DEFAULT 'active',
  source_version TEXT NOT NULL,
  projection_version TEXT NOT NULL,
  projected_at TIMESTAMPTZ NOT NULL,
  projection_ttl_seconds INTEGER NOT NULL DEFAULT 300,
  stale_after TIMESTAMPTZ NOT NULL,
  source_authoritative BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT platform_case_source_system_ck
    CHECK (source_system IN ('dopams', 'iqw')),
  CONSTRAINT platform_case_source_status_ck
    CHECK (source_status IN ('active', 'deleted', 'sealed', 'purged', 'superseded', 'retained_inaccessible', 'unknown')),
  CONSTRAINT platform_case_classification_ck
    CHECK (classification IN ('public', 'restricted', 'confidential', 'secret')),
  CONSTRAINT platform_case_legal_hold_ck
    CHECK (legal_hold_status IN ('none', 'active', 'released', 'unknown')),
  CONSTRAINT platform_case_retention_ck
    CHECK (retention_status IN ('active', 'hold', 'archive_due', 'purge_due', 'retained_inaccessible', 'unknown')),
  CONSTRAINT platform_case_ttl_positive_ck
    CHECK (projection_ttl_seconds > 0),
  CONSTRAINT platform_case_stale_after_ck
    CHECK (stale_after >= projected_at),
  CONSTRAINT platform_case_source_authoritative_ck
    CHECK (source_authoritative = TRUE),
  CONSTRAINT platform_case_redaction_storage_ck
    CHECK (NOT ('storage_uri' = ANY(redacted_fields)) OR redaction_profile <> '')
);

CREATE INDEX IF NOT EXISTS platform_case_source_idx
  ON platform.platform_case (source_system, source_record_id);

CREATE INDEX IF NOT EXISTS platform_case_freshness_idx
  ON platform.platform_case (source_status, stale_after);

CREATE INDEX IF NOT EXISTS platform_case_jurisdiction_gin_idx
  ON platform.platform_case USING GIN (jurisdiction);

CREATE TABLE IF NOT EXISTS platform.platform_case_link (
  link_id TEXT PRIMARY KEY,
  left_case_id TEXT NOT NULL REFERENCES platform.platform_case(case_id),
  right_case_id TEXT NOT NULL REFERENCES platform.platform_case(case_id),
  link_type TEXT NOT NULL,
  source_version TEXT NOT NULL,
  projection_version TEXT NOT NULL,
  projected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  projection_ttl_seconds INTEGER NOT NULL DEFAULT 300,
  stale_after TIMESTAMPTZ NOT NULL,
  source_authoritative BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT platform_case_link_not_self_ck
    CHECK (left_case_id <> right_case_id),
  CONSTRAINT platform_case_link_ttl_positive_ck
    CHECK (projection_ttl_seconds > 0),
  CONSTRAINT platform_case_link_stale_after_ck
    CHECK (stale_after >= projected_at),
  CONSTRAINT platform_case_link_source_authoritative_ck
    CHECK (source_authoritative = TRUE),
  CONSTRAINT platform_case_link_unique_pair_ck
    UNIQUE (left_case_id, right_case_id, link_type)
);

CREATE INDEX IF NOT EXISTS platform_case_link_left_idx
  ON platform.platform_case_link (left_case_id);

CREATE INDEX IF NOT EXISTS platform_case_link_right_idx
  ON platform.platform_case_link (right_case_id);
