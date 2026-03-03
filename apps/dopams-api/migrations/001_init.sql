-- DOPAMS Initial Schema
-- Drug Offenders Profiling and Monitoring System

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── User & Role Management ────────────────────────────────────────────────

CREATE TABLE user_account (
  user_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username      VARCHAR(128) NOT NULL UNIQUE,
  password_hash VARCHAR(256) NOT NULL,
  full_name     VARCHAR(256) NOT NULL,
  user_type     VARCHAR(32)  NOT NULL DEFAULT 'OFFICER',
  email         VARCHAR(256),
  phone         VARCHAR(20),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE role (
  role_id     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_key    VARCHAR(64) NOT NULL UNIQUE,
  display_name VARCHAR(128) NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_role (
  user_id    UUID NOT NULL REFERENCES user_account(user_id),
  role_id    UUID NOT NULL REFERENCES role(role_id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, role_id)
);

-- ── Subject Profiles ──────────────────────────────────────────────────────

CREATE TABLE subject_profile (
  subject_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name     VARCHAR(256) NOT NULL,
  aliases       JSONB DEFAULT '[]'::jsonb,
  date_of_birth DATE,
  gender        VARCHAR(16),
  identifiers   JSONB DEFAULT '{}'::jsonb,
  addresses     JSONB DEFAULT '[]'::jsonb,
  photo_url     TEXT,
  risk_score    NUMERIC(5,2),
  state_id      VARCHAR(64) NOT NULL DEFAULT 'DRAFT',
  row_version   INTEGER NOT NULL DEFAULT 1,
  created_by    UUID REFERENCES user_account(user_id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subject_profile_state ON subject_profile(state_id);
CREATE INDEX idx_subject_profile_name ON subject_profile(full_name);

-- ── Cases ─────────────────────────────────────────────────────────────────

CREATE TABLE dopams_case (
  case_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_number   VARCHAR(64) UNIQUE,
  title         VARCHAR(256) NOT NULL,
  description   TEXT,
  case_type     VARCHAR(64),
  priority      VARCHAR(16) DEFAULT 'MEDIUM',
  state_id      VARCHAR(64) NOT NULL DEFAULT 'OPEN',
  row_version   INTEGER NOT NULL DEFAULT 1,
  assigned_to   UUID REFERENCES user_account(user_id),
  created_by    UUID REFERENCES user_account(user_id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dopams_case_state ON dopams_case(state_id);

-- ── Case-Subject Link ─────────────────────────────────────────────────────

CREATE TABLE case_subject (
  case_id    UUID NOT NULL REFERENCES dopams_case(case_id),
  subject_id UUID NOT NULL REFERENCES subject_profile(subject_id),
  role       VARCHAR(32) DEFAULT 'SUBJECT',
  linked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (case_id, subject_id)
);

-- ── Source Documents ──────────────────────────────────────────────────────

CREATE TABLE source_document (
  document_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_type VARCHAR(64) NOT NULL,
  source_system VARCHAR(64),
  file_url      TEXT,
  file_name     VARCHAR(256),
  file_size_bytes BIGINT,
  mime_type     VARCHAR(128),
  metadata_jsonb JSONB DEFAULT '{}'::jsonb,
  uploaded_by   UUID REFERENCES user_account(user_id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Extraction Fields ─────────────────────────────────────────────────────

CREATE TABLE extraction_field (
  extraction_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id   UUID NOT NULL REFERENCES source_document(document_id),
  subject_id    UUID REFERENCES subject_profile(subject_id),
  field_key     VARCHAR(128) NOT NULL,
  field_value   TEXT,
  confidence    NUMERIC(5,4),
  extracted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_extraction_field_doc ON extraction_field(document_id);

-- ── Communication Events ──────────────────────────────────────────────────

CREATE TABLE communication_event (
  event_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id     UUID REFERENCES subject_profile(subject_id),
  case_id        UUID REFERENCES dopams_case(case_id),
  comm_type      VARCHAR(32) NOT NULL,
  direction      VARCHAR(16),
  counterparty   VARCHAR(256),
  content_summary TEXT,
  occurred_at    TIMESTAMPTZ,
  metadata_jsonb JSONB DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comm_event_subject ON communication_event(subject_id);

-- ── Financial Transactions ────────────────────────────────────────────────

CREATE TABLE financial_transaction (
  txn_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id    UUID REFERENCES subject_profile(subject_id),
  case_id       UUID REFERENCES dopams_case(case_id),
  txn_type      VARCHAR(32) NOT NULL,
  amount        NUMERIC(15,2),
  currency      VARCHAR(3) DEFAULT 'INR',
  counterparty  VARCHAR(256),
  bank_ref      VARCHAR(128),
  occurred_at   TIMESTAMPTZ,
  metadata_jsonb JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fin_txn_subject ON financial_transaction(subject_id);

-- ── Leads ─────────────────────────────────────────────────────────────────

CREATE TABLE lead (
  lead_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_type   VARCHAR(64) NOT NULL,
  summary       TEXT NOT NULL,
  details       TEXT,
  priority      VARCHAR(16) DEFAULT 'MEDIUM',
  state_id      VARCHAR(64) NOT NULL DEFAULT 'NEW',
  row_version   INTEGER NOT NULL DEFAULT 1,
  subject_id    UUID REFERENCES subject_profile(subject_id),
  assigned_to   UUID REFERENCES user_account(user_id),
  created_by    UUID REFERENCES user_account(user_id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lead_state ON lead(state_id);

-- ── Memos ─────────────────────────────────────────────────────────────────

CREATE TABLE memo (
  memo_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id       UUID REFERENCES lead(lead_id),
  memo_number   VARCHAR(64),
  subject       VARCHAR(256) NOT NULL,
  body          TEXT NOT NULL,
  state_id      VARCHAR(64) NOT NULL DEFAULT 'DRAFT',
  row_version   INTEGER NOT NULL DEFAULT 1,
  created_by    UUID REFERENCES user_account(user_id),
  approved_by   UUID REFERENCES user_account(user_id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Alerts ────────────────────────────────────────────────────────────────

CREATE TABLE alert (
  alert_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_type    VARCHAR(64) NOT NULL,
  severity      VARCHAR(16) NOT NULL DEFAULT 'MEDIUM',
  title         VARCHAR(256) NOT NULL,
  description   TEXT,
  source_system VARCHAR(64),
  subject_id    UUID REFERENCES subject_profile(subject_id),
  case_id       UUID REFERENCES dopams_case(case_id),
  state_id      VARCHAR(64) NOT NULL DEFAULT 'OPEN',
  row_version   INTEGER NOT NULL DEFAULT 1,
  assigned_to   UUID REFERENCES user_account(user_id),
  acknowledged_by UUID REFERENCES user_account(user_id),
  acknowledged_at TIMESTAMPTZ,
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alert_state ON alert(state_id);
CREATE INDEX idx_alert_severity ON alert(severity);

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
CREATE INDEX idx_task_assignee ON task(assignee_user_id);

-- ── Audit Events ──────────────────────────────────────────────────────────

CREATE TABLE audit_event (
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

CREATE INDEX idx_audit_entity ON audit_event(entity_type, entity_id);
CREATE INDEX idx_audit_created ON audit_event(created_at);

-- ── Seed Roles ────────────────────────────────────────────────────────────

INSERT INTO role (role_key, display_name, description) VALUES
  ('DISTRICT_OPERATOR', 'District Operator', 'Handles district-level data entry and lead validation'),
  ('TOLL_FREE_OPERATOR', 'Toll-Free Operator', 'Receives and validates phone-based leads'),
  ('INTELLIGENCE_ANALYST', 'Intelligence Analyst', 'Analyzes intelligence data and manages subject profiles'),
  ('SUPERVISORY_OFFICER', 'Supervisory Officer', 'Supervises operations and approves memos'),
  ('ZONAL_OFFICER', 'Zonal Officer', 'Handles escalated alerts and zonal oversight'),
  ('INVESTIGATING_OFFICER', 'Investigating Officer', 'Conducts field investigations on routed leads'),
  ('ADMINISTRATOR', 'Administrator', 'System administrator with full access');
