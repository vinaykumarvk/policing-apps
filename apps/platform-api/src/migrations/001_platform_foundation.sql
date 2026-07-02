CREATE SCHEMA IF NOT EXISTS platform;

CREATE TABLE IF NOT EXISTS platform.app_registry (
  app_id TEXT PRIMARY KEY,
  module TEXT NOT NULL,
  domain TEXT NOT NULL,
  label TEXT NOT NULL,
  state TEXT NOT NULL,
  description TEXT NOT NULL,
  launch_url TEXT,
  status_reason_code TEXT NOT NULL,
  platform_claim_gate_status TEXT NOT NULL,
  server_side_claims_enforced BOOLEAN NOT NULL DEFAULT FALSE,
  gate_evidence_ref TEXT NOT NULL,
  gate_checked_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT app_registry_state_ck
    CHECK (state IN ('planned', 'pilot', 'available', 'blocked')),
  CONSTRAINT app_registry_gate_status_ck
    CHECK (platform_claim_gate_status IN ('passed', 'pending', 'failed')),
  CONSTRAINT inactive_apps_do_not_launch_ck
    CHECK (
      (state IN ('planned', 'blocked') AND launch_url IS NULL)
      OR state IN ('pilot', 'available')
    ),
  CONSTRAINT launch_requires_platform_claim_gate_ck
    CHECK (
      launch_url IS NULL
      OR (
        state IN ('pilot', 'available')
        AND platform_claim_gate_status = 'passed'
        AND server_side_claims_enforced = TRUE
      )
    )
);

CREATE INDEX IF NOT EXISTS app_registry_state_idx
  ON platform.app_registry (state, domain);

CREATE TABLE IF NOT EXISTS platform.entitlement_check_audit (
  check_id UUID PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL,
  correlation_id TEXT NOT NULL,
  subject_id TEXT,
  module TEXT NOT NULL,
  domain TEXT NOT NULL,
  permission TEXT NOT NULL,
  outcome TEXT NOT NULL,
  reason TEXT NOT NULL,
  decision_evidence_id TEXT NOT NULL,
  CONSTRAINT entitlement_check_outcome_ck
    CHECK (outcome IN ('allow', 'deny'))
);

CREATE INDEX IF NOT EXISTS entitlement_check_audit_correlation_idx
  ON platform.entitlement_check_audit (correlation_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS platform.authorization_decision_evidence (
  decision_id TEXT PRIMARY KEY,
  evidence_schema_version TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  correlation_id TEXT NOT NULL,
  outcome TEXT NOT NULL,
  reason TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  entitlement_policy_version TEXT NOT NULL,
  path TEXT NOT NULL,
  action TEXT NOT NULL,
  claims_snapshot JSONB NOT NULL,
  resource JSONB NOT NULL,
  redaction_decision JSONB NOT NULL,
  decision_inputs JSONB NOT NULL,
  retrieval JSONB,
  integrity JSONB NOT NULL,
  inserted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT authorization_decision_evidence_schema_ck
    CHECK (evidence_schema_version = 'platform.authorization_decision_evidence.v1'),
  CONSTRAINT authorization_decision_evidence_outcome_ck
    CHECK (outcome IN ('allow', 'deny')),
  CONSTRAINT authorization_decision_evidence_no_storage_uri_ck
    CHECK (
      redaction_decision ? 'storage_uri_exposed'
      AND (redaction_decision ->> 'storage_uri_exposed')::BOOLEAN = FALSE
    )
);

CREATE INDEX IF NOT EXISTS authorization_decision_evidence_correlation_idx
  ON platform.authorization_decision_evidence (correlation_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS authorization_decision_evidence_outcome_idx
  ON platform.authorization_decision_evidence (outcome, reason, occurred_at DESC);

CREATE OR REPLACE FUNCTION platform.prevent_authorization_decision_evidence_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'authorization decision evidence is append-only';
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'authorization_decision_evidence_append_only_trg'
  ) THEN
    CREATE TRIGGER authorization_decision_evidence_append_only_trg
      BEFORE UPDATE OR DELETE ON platform.authorization_decision_evidence
      FOR EACH ROW
      EXECUTE FUNCTION platform.prevent_authorization_decision_evidence_mutation();
  END IF;
END;
$$;
