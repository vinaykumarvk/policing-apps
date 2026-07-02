CREATE SCHEMA IF NOT EXISTS platform;

CREATE TABLE IF NOT EXISTS platform.platform_evidence (
  evidence_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  source_system TEXT NOT NULL,
  source_record_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  hash_sha256 TEXT NOT NULL,
  chain_of_custody_head TEXT NOT NULL,
  source_status TEXT NOT NULL,
  classification TEXT NOT NULL,
  legal_hold_status TEXT NOT NULL,
  retention_status TEXT NOT NULL,
  storage_reference TEXT NOT NULL,
  storage_uri_present BOOLEAN NOT NULL DEFAULT FALSE,
  storage_uri_exposed_by_default BOOLEAN NOT NULL DEFAULT FALSE,
  org_id TEXT NOT NULL,
  unit_id TEXT,
  jurisdiction JSONB NOT NULL,
  assignment JSONB NOT NULL,
  field_classification JSONB NOT NULL,
  redaction_profile TEXT NOT NULL,
  redacted_fields TEXT[] NOT NULL DEFAULT ARRAY['storage_uri']::TEXT[],
  source_version TEXT NOT NULL,
  projection_version TEXT NOT NULL,
  projected_at TIMESTAMPTZ NOT NULL,
  projection_ttl_seconds INTEGER NOT NULL DEFAULT 300,
  stale_after TIMESTAMPTZ NOT NULL,
  source_authoritative BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT platform_evidence_source_system_ck
    CHECK (source_system IN ('dopams', 'iqw')),
  CONSTRAINT platform_evidence_size_ck
    CHECK (size_bytes >= 0),
  CONSTRAINT platform_evidence_source_status_ck
    CHECK (source_status IN ('active', 'deleted', 'sealed', 'purged', 'superseded', 'retained_inaccessible', 'unknown')),
  CONSTRAINT platform_evidence_classification_ck
    CHECK (classification IN ('public', 'restricted', 'confidential', 'secret')),
  CONSTRAINT platform_evidence_legal_hold_ck
    CHECK (legal_hold_status IN ('none', 'active', 'released', 'unknown')),
  CONSTRAINT platform_evidence_retention_ck
    CHECK (retention_status IN ('active', 'hold', 'archive_due', 'purge_due', 'unknown')),
  CONSTRAINT platform_evidence_ttl_positive_ck
    CHECK (projection_ttl_seconds > 0),
  CONSTRAINT platform_evidence_stale_after_ck
    CHECK (stale_after >= projected_at),
  CONSTRAINT platform_evidence_source_authoritative_ck
    CHECK (source_authoritative = TRUE),
  CONSTRAINT platform_evidence_storage_uri_default_ck
    CHECK (storage_uri_present = FALSE AND storage_uri_exposed_by_default = FALSE),
  CONSTRAINT platform_evidence_storage_uri_redacted_ck
    CHECK ('storage_uri' = ANY(redacted_fields))
);

CREATE INDEX IF NOT EXISTS platform_evidence_case_idx
  ON platform.platform_evidence (case_id);

CREATE INDEX IF NOT EXISTS platform_evidence_source_idx
  ON platform.platform_evidence (source_system, source_record_id);

CREATE INDEX IF NOT EXISTS platform_evidence_freshness_idx
  ON platform.platform_evidence (source_status, retention_status, legal_hold_status, stale_after);

CREATE TABLE IF NOT EXISTS platform.platform_evidence_link (
  link_id TEXT PRIMARY KEY,
  evidence_id TEXT NOT NULL REFERENCES platform.platform_evidence(evidence_id),
  case_id TEXT NOT NULL,
  link_type TEXT NOT NULL,
  source_version TEXT NOT NULL,
  projection_version TEXT NOT NULL,
  projected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  projection_ttl_seconds INTEGER NOT NULL DEFAULT 300,
  stale_after TIMESTAMPTZ NOT NULL,
  source_authoritative BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT platform_evidence_link_ttl_positive_ck
    CHECK (projection_ttl_seconds > 0),
  CONSTRAINT platform_evidence_link_stale_after_ck
    CHECK (stale_after >= projected_at),
  CONSTRAINT platform_evidence_link_source_authoritative_ck
    CHECK (source_authoritative = TRUE),
  CONSTRAINT platform_evidence_link_unique_case_ck
    UNIQUE (evidence_id, case_id, link_type)
);

CREATE INDEX IF NOT EXISTS platform_evidence_link_case_idx
  ON platform.platform_evidence_link (case_id);

CREATE INDEX IF NOT EXISTS platform_evidence_link_evidence_idx
  ON platform.platform_evidence_link (evidence_id);
