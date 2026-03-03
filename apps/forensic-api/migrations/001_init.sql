-- Forensic Digital Intelligence Initial Schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── User & Role Management ────────────────────────────────────────────────

CREATE TABLE user_account (
  user_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username      VARCHAR(128) NOT NULL UNIQUE,
  password_hash VARCHAR(256) NOT NULL,
  full_name     VARCHAR(256) NOT NULL,
  user_type     VARCHAR(32)  NOT NULL DEFAULT 'ANALYST',
  email         VARCHAR(256),
  phone         VARCHAR(20),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE role (
  role_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_key     VARCHAR(64) NOT NULL UNIQUE,
  display_name VARCHAR(128) NOT NULL,
  description  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_role (
  user_id     UUID NOT NULL REFERENCES user_account(user_id),
  role_id     UUID NOT NULL REFERENCES role(role_id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, role_id)
);

-- ── Forensic Cases ────────────────────────────────────────────────────────

CREATE TABLE forensic_case (
  case_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_number   VARCHAR(64) UNIQUE,
  title         VARCHAR(256) NOT NULL,
  description   TEXT,
  case_type     VARCHAR(64),
  priority      VARCHAR(16) DEFAULT 'MEDIUM',
  state_id      VARCHAR(64) NOT NULL DEFAULT 'DRAFT',
  row_version   INTEGER NOT NULL DEFAULT 1,
  assigned_to   UUID REFERENCES user_account(user_id),
  created_by    UUID REFERENCES user_account(user_id),
  dopams_case_ref VARCHAR(128),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_forensic_case_state ON forensic_case(state_id);

-- ── Evidence Sources ──────────────────────────────────────────────────────

CREATE TABLE evidence_source (
  evidence_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id       UUID NOT NULL REFERENCES forensic_case(case_id),
  source_type   VARCHAR(64) NOT NULL,
  device_info   JSONB DEFAULT '{}'::jsonb,
  file_url      TEXT,
  file_name     VARCHAR(256),
  file_size_bytes BIGINT,
  hash_sha256   VARCHAR(64),
  chain_of_custody JSONB DEFAULT '[]'::jsonb,
  state_id      VARCHAR(64) NOT NULL DEFAULT 'PENDING',
  row_version   INTEGER NOT NULL DEFAULT 1,
  uploaded_by   UUID REFERENCES user_account(user_id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_evidence_case ON evidence_source(case_id);

-- ── Import Jobs ───────────────────────────────────────────────────────────

CREATE TABLE import_job (
  import_job_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id       UUID NOT NULL REFERENCES forensic_case(case_id),
  evidence_id   UUID REFERENCES evidence_source(evidence_id),
  job_type      VARCHAR(64) NOT NULL,
  state_id      VARCHAR(64) NOT NULL DEFAULT 'QUEUED',
  row_version   INTEGER NOT NULL DEFAULT 1,
  progress_pct  NUMERIC(5,2) DEFAULT 0,
  error_message TEXT,
  warnings      JSONB DEFAULT '[]'::jsonb,
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_import_job_case ON import_job(case_id);
CREATE INDEX idx_import_job_state ON import_job(state_id);

-- ── Artifacts ─────────────────────────────────────────────────────────────

CREATE TABLE artifact (
  artifact_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id       UUID NOT NULL REFERENCES forensic_case(case_id),
  import_job_id UUID REFERENCES import_job(import_job_id),
  artifact_type VARCHAR(64) NOT NULL,
  source_path   TEXT,
  content_preview TEXT,
  metadata_jsonb JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_artifact_case ON artifact(case_id);
CREATE INDEX idx_artifact_type ON artifact(artifact_type);

-- ── Extracted Entities ────────────────────────────────────────────────────

CREATE TABLE extracted_entity (
  entity_id     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id       UUID NOT NULL REFERENCES forensic_case(case_id),
  artifact_id   UUID REFERENCES artifact(artifact_id),
  entity_type   VARCHAR(64) NOT NULL,
  entity_value  TEXT NOT NULL,
  confidence    NUMERIC(5,4),
  metadata_jsonb JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_extracted_entity_case ON extracted_entity(case_id);

-- ── Relationships ─────────────────────────────────────────────────────────

CREATE TABLE relationship (
  relationship_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id       UUID NOT NULL REFERENCES forensic_case(case_id),
  source_entity_id UUID NOT NULL REFERENCES extracted_entity(entity_id),
  target_entity_id UUID NOT NULL REFERENCES extracted_entity(entity_id),
  relationship_type VARCHAR(64) NOT NULL,
  weight        NUMERIC(5,4) DEFAULT 1.0,
  metadata_jsonb JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_relationship_case ON relationship(case_id);

-- ── AI Findings ───────────────────────────────────────────────────────────

CREATE TABLE ai_finding (
  finding_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id       UUID NOT NULL REFERENCES forensic_case(case_id),
  finding_type  VARCHAR(64) NOT NULL,
  severity      VARCHAR(16) DEFAULT 'MEDIUM',
  title         VARCHAR(256) NOT NULL,
  description   TEXT,
  evidence_refs JSONB DEFAULT '[]'::jsonb,
  confidence    NUMERIC(5,4),
  state_id      VARCHAR(64) NOT NULL DEFAULT 'UNREVIEWED',
  row_version   INTEGER NOT NULL DEFAULT 1,
  reviewed_by   UUID REFERENCES user_account(user_id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_finding_case ON ai_finding(case_id);
CREATE INDEX idx_ai_finding_state ON ai_finding(state_id);

-- ── Risk Scores ───────────────────────────────────────────────────────────

CREATE TABLE risk_score (
  risk_score_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id       UUID NOT NULL REFERENCES forensic_case(case_id),
  entity_id     UUID REFERENCES extracted_entity(entity_id),
  score_type    VARCHAR(64) NOT NULL,
  score_value   NUMERIC(5,2) NOT NULL,
  factors       JSONB DEFAULT '[]'::jsonb,
  computed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Legal Mappings ────────────────────────────────────────────────────────

CREATE TABLE legal_mapping (
  legal_mapping_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id       UUID NOT NULL REFERENCES forensic_case(case_id),
  finding_id    UUID REFERENCES ai_finding(finding_id),
  statute       VARCHAR(256) NOT NULL,
  section       VARCHAR(64),
  description   TEXT,
  relevance     NUMERIC(5,4),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Reports ───────────────────────────────────────────────────────────────

CREATE TABLE report (
  report_id     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id       UUID NOT NULL REFERENCES forensic_case(case_id),
  title         VARCHAR(256) NOT NULL,
  report_type   VARCHAR(64) NOT NULL DEFAULT 'ANALYSIS',
  template_id   VARCHAR(64),
  content_jsonb JSONB DEFAULT '{}'::jsonb,
  state_id      VARCHAR(64) NOT NULL DEFAULT 'DRAFT',
  row_version   INTEGER NOT NULL DEFAULT 1,
  version_number INTEGER NOT NULL DEFAULT 1,
  supersedes_id UUID REFERENCES report(report_id),
  created_by    UUID REFERENCES user_account(user_id),
  approved_by   UUID REFERENCES user_account(user_id),
  published_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_report_case ON report(case_id);
CREATE INDEX idx_report_state ON report(state_id);

-- ── Alerts ────────────────────────────────────────────────────────────────

CREATE TABLE alert (
  alert_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id       UUID REFERENCES forensic_case(case_id),
  alert_type    VARCHAR(64) NOT NULL,
  severity      VARCHAR(16) DEFAULT 'MEDIUM',
  title         VARCHAR(256) NOT NULL,
  description   TEXT,
  is_read       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Annotations ───────────────────────────────────────────────────────────

CREATE TABLE annotation (
  annotation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id       UUID NOT NULL REFERENCES forensic_case(case_id),
  entity_type   VARCHAR(64) NOT NULL,
  entity_id     UUID NOT NULL,
  annotation_text TEXT NOT NULL,
  created_by    UUID REFERENCES user_account(user_id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── DOPAMS Sync Events ────────────────────────────────────────────────────

CREATE TABLE dopams_sync_event (
  sync_event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id       UUID REFERENCES forensic_case(case_id),
  sync_type     VARCHAR(64) NOT NULL,
  direction     VARCHAR(16) NOT NULL DEFAULT 'OUTBOUND',
  status        VARCHAR(16) NOT NULL DEFAULT 'PENDING',
  payload_jsonb JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ
);

-- ── Tasks ─────────────────────────────────────────────────────────────────

CREATE TABLE task (
  task_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type   VARCHAR(64) NOT NULL,
  entity_id     UUID NOT NULL,
  state_id      VARCHAR(64) NOT NULL,
  role_id       VARCHAR(64) NOT NULL,
  status        VARCHAR(16) NOT NULL DEFAULT 'PENDING',
  decision      VARCHAR(64),
  remarks       TEXT,
  assignee_user_id UUID REFERENCES user_account(user_id),
  sla_due_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_task_status ON task(status);
CREATE INDEX idx_task_entity ON task(entity_type, entity_id);

-- ── Audit Events ──────────────────────────────────────────────────────────

CREATE TABLE audit_event (
  audit_event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type   VARCHAR(64) NOT NULL,
  entity_id     UUID NOT NULL,
  event_type    VARCHAR(64) NOT NULL,
  from_state    VARCHAR(64),
  to_state      VARCHAR(64),
  transition_id VARCHAR(64),
  actor_type    VARCHAR(32) NOT NULL,
  actor_id      UUID NOT NULL,
  remarks       TEXT,
  payload_jsonb JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_event_entity ON audit_event(entity_type, entity_id);

-- ── Config Version ────────────────────────────────────────────────────────

CREATE TABLE config_version (
  config_version_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  config_key    VARCHAR(64) NOT NULL,
  version       VARCHAR(32) NOT NULL,
  config_jsonb  JSONB NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (config_key, version)
);

-- ── Seed Roles ────────────────────────────────────────────────────────────

INSERT INTO role (role_key, display_name, description) VALUES
  ('FORENSIC_ANALYST', 'Forensic Analyst', 'Primary analyst who processes and reviews digital evidence'),
  ('SUPERVISOR', 'Supervisor', 'Supervises analysts and approves reports'),
  ('ADMINISTRATOR', 'Administrator', 'System administrator with full access'),
  ('LEGAL_ADVISOR', 'Legal Advisor', 'Provides legal mapping and statute guidance');
