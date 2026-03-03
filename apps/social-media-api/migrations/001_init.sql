-- Social Media Monitoring & Intelligence Initial Schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Organization & User Management ───────────────────────────────────────

CREATE TABLE organization_unit (
  unit_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(256) NOT NULL,
  unit_type     VARCHAR(64) NOT NULL,
  parent_unit_id UUID REFERENCES organization_unit(unit_id),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_account (
  user_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username      VARCHAR(128) NOT NULL UNIQUE,
  password_hash VARCHAR(256) NOT NULL,
  full_name     VARCHAR(256) NOT NULL,
  user_type     VARCHAR(32) NOT NULL DEFAULT 'ANALYST',
  email         VARCHAR(256),
  phone         VARCHAR(20),
  unit_id       UUID REFERENCES organization_unit(unit_id),
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

-- ── Source Connectors ─────────────────────────────────────────────────────

CREATE TABLE source_connector (
  connector_id  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform      VARCHAR(64) NOT NULL,
  connector_type VARCHAR(64) NOT NULL,
  config_jsonb  JSONB DEFAULT '{}'::jsonb,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  last_poll_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Taxonomy ──────────────────────────────────────────────────────────────

CREATE TABLE taxonomy_category (
  category_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(128) NOT NULL,
  parent_id     UUID REFERENCES taxonomy_category(category_id),
  description   TEXT,
  threat_level  VARCHAR(16),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Content Items ─────────────────────────────────────────────────────────

CREATE TABLE content_item (
  content_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  connector_id  UUID REFERENCES source_connector(connector_id),
  platform      VARCHAR(64) NOT NULL,
  platform_post_id VARCHAR(256),
  author_handle VARCHAR(256),
  author_name   VARCHAR(256),
  content_text  TEXT,
  content_url   TEXT,
  language      VARCHAR(8),
  sentiment     VARCHAR(16),
  category_id   UUID REFERENCES taxonomy_category(category_id),
  threat_score  NUMERIC(5,2),
  metadata_jsonb JSONB DEFAULT '{}'::jsonb,
  published_at  TIMESTAMPTZ,
  ingested_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_content_platform ON content_item(platform);
CREATE INDEX idx_content_threat ON content_item(threat_score);
CREATE INDEX idx_content_published ON content_item(published_at);

CREATE TABLE content_media (
  media_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id    UUID NOT NULL REFERENCES content_item(content_id),
  media_type    VARCHAR(32) NOT NULL,
  media_url     TEXT NOT NULL,
  file_size_bytes BIGINT,
  hash_sha256   VARCHAR(64),
  analysis_jsonb JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_content_media_content ON content_media(content_id);

-- ── Alerts ────────────────────────────────────────────────────────────────

CREATE TABLE sm_alert (
  alert_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_type    VARCHAR(64) NOT NULL,
  priority      VARCHAR(16) NOT NULL DEFAULT 'MEDIUM',
  title         VARCHAR(256) NOT NULL,
  description   TEXT,
  content_id    UUID REFERENCES content_item(content_id),
  category_id   UUID REFERENCES taxonomy_category(category_id),
  state_id      VARCHAR(64) NOT NULL DEFAULT 'NEW',
  row_version   INTEGER NOT NULL DEFAULT 1,
  assigned_to   UUID REFERENCES user_account(user_id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sm_alert_state ON sm_alert(state_id);
CREATE INDEX idx_sm_alert_priority ON sm_alert(priority);

CREATE TABLE alert_action (
  action_id     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_id      UUID NOT NULL REFERENCES sm_alert(alert_id),
  action_type   VARCHAR(64) NOT NULL,
  notes         TEXT,
  performed_by  UUID REFERENCES user_account(user_id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Evidence ──────────────────────────────────────────────────────────────

CREATE TABLE evidence_item (
  evidence_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id    UUID REFERENCES content_item(content_id),
  alert_id      UUID REFERENCES sm_alert(alert_id),
  case_id       UUID,
  capture_type  VARCHAR(64) NOT NULL,
  screenshot_url TEXT,
  archive_url   TEXT,
  hash_sha256   VARCHAR(64),
  chain_of_custody JSONB DEFAULT '[]'::jsonb,
  state_id      VARCHAR(64) NOT NULL DEFAULT 'CAPTURE_REQUESTED',
  row_version   INTEGER NOT NULL DEFAULT 1,
  captured_by   UUID REFERENCES user_account(user_id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_evidence_state ON evidence_item(state_id);

-- ── Cases ─────────────────────────────────────────────────────────────────

CREATE TABLE case_record (
  case_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_number   VARCHAR(64) UNIQUE,
  title         VARCHAR(256) NOT NULL,
  description   TEXT,
  source_alert_id UUID REFERENCES sm_alert(alert_id),
  priority      VARCHAR(16) DEFAULT 'MEDIUM',
  state_id      VARCHAR(64) NOT NULL DEFAULT 'OPEN',
  row_version   INTEGER NOT NULL DEFAULT 1,
  assigned_to   UUID REFERENCES user_account(user_id),
  created_by    UUID REFERENCES user_account(user_id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE evidence_item ADD CONSTRAINT fk_evidence_case FOREIGN KEY (case_id) REFERENCES case_record(case_id);

CREATE INDEX idx_case_state ON case_record(state_id);

CREATE TABLE case_task (
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

CREATE INDEX idx_case_task_status ON case_task(status);
CREATE INDEX idx_case_task_entity ON case_task(entity_type, entity_id);

-- ── Legal Mapping ─────────────────────────────────────────────────────────

CREATE TABLE legal_mapping_rule (
  rule_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  statute       VARCHAR(256) NOT NULL,
  section       VARCHAR(64),
  description   TEXT,
  keyword_patterns JSONB DEFAULT '[]'::jsonb,
  threat_categories JSONB DEFAULT '[]'::jsonb,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE legal_mapping_result (
  mapping_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_id      UUID REFERENCES sm_alert(alert_id),
  case_id       UUID REFERENCES case_record(case_id),
  rule_id       UUID NOT NULL REFERENCES legal_mapping_rule(rule_id),
  confidence    NUMERIC(5,4),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Reports ───────────────────────────────────────────────────────────────

CREATE TABLE report_template (
  template_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(128) NOT NULL,
  template_type VARCHAR(64) NOT NULL,
  content_jsonb JSONB DEFAULT '{}'::jsonb,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE report_instance (
  report_id     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id       UUID REFERENCES case_record(case_id),
  template_id   UUID REFERENCES report_template(template_id),
  title         VARCHAR(256) NOT NULL,
  content_jsonb JSONB DEFAULT '{}'::jsonb,
  state_id      VARCHAR(64) NOT NULL DEFAULT 'DRAFT',
  row_version   INTEGER NOT NULL DEFAULT 1,
  created_by    UUID REFERENCES user_account(user_id),
  approved_by   UUID REFERENCES user_account(user_id),
  exported_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_report_state ON report_instance(state_id);

-- ── Notifications ─────────────────────────────────────────────────────────

CREATE TABLE notification_event (
  notification_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID REFERENCES user_account(user_id),
  notification_type VARCHAR(64) NOT NULL,
  title         VARCHAR(256) NOT NULL,
  body          TEXT,
  is_read       BOOLEAN NOT NULL DEFAULT FALSE,
  entity_type   VARCHAR(64),
  entity_id     UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Watchlists ────────────────────────────────────────────────────────────

CREATE TABLE watchlist (
  watchlist_id  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(128) NOT NULL,
  description   TEXT,
  keywords      JSONB DEFAULT '[]'::jsonb,
  platforms     JSONB DEFAULT '[]'::jsonb,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_by    UUID REFERENCES user_account(user_id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Translations ──────────────────────────────────────────────────────────

CREATE TABLE translation_record (
  translation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id    UUID REFERENCES content_item(content_id),
  source_lang   VARCHAR(8) NOT NULL,
  target_lang   VARCHAR(8) NOT NULL DEFAULT 'en',
  translated_text TEXT NOT NULL,
  engine        VARCHAR(64),
  confidence    NUMERIC(5,4),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Audit Log ─────────────────────────────────────────────────────────────

CREATE TABLE audit_log (
  audit_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at);

-- ── Seed Roles ────────────────────────────────────────────────────────────

INSERT INTO role (role_key, display_name, description) VALUES
  ('INTELLIGENCE_ANALYST', 'Intelligence Analyst', 'Monitors social media content and manages alerts'),
  ('CONTROL_ROOM_OPERATOR', 'Control Room Operator', 'Handles critical escalations in real-time'),
  ('SUPERVISOR', 'Supervisor', 'Supervises analysts and approves cases/reports'),
  ('INVESTIGATOR', 'Investigator', 'Conducts detailed case investigations'),
  ('LEGAL_REVIEWER', 'Legal Reviewer', 'Reviews evidence and reports for legal compliance'),
  ('EVIDENCE_CUSTODIAN', 'Evidence Custodian', 'Manages evidence integrity and chain of custody'),
  ('PLATFORM_ADMINISTRATOR', 'Platform Administrator', 'System administrator with full access');
