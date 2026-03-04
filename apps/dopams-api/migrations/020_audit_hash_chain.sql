-- 020_audit_hash_chain.sql
-- Tamper-evident hash chain for audit_event rows and immutability rules.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Hash chain columns ──────────────────────────────────────────────────────

ALTER TABLE audit_event
  ADD COLUMN IF NOT EXISTS prev_event_hash TEXT,
  ADD COLUMN IF NOT EXISTS event_hash      TEXT,
  ADD COLUMN IF NOT EXISTS hash_version    SMALLINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS chain_position  BIGINT;

-- Monotonic insert-order sequence for deterministic chain ordering.
CREATE SEQUENCE IF NOT EXISTS audit_chain_seq;

CREATE INDEX IF NOT EXISTS idx_audit_chain_order
  ON audit_event(chain_position);
CREATE UNIQUE INDEX IF NOT EXISTS idx_audit_event_hash_unique
  ON audit_event(event_hash) WHERE event_hash IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_audit_chain_position_unique
  ON audit_event(chain_position) WHERE chain_position IS NOT NULL;

-- ── Trigger: compute hash on every INSERT ───────────────────────────────────

CREATE OR REPLACE FUNCTION set_audit_event_hash_chain()
RETURNS trigger AS $$
DECLARE
  previous_hash    TEXT;
  canonical_payload TEXT;
BEGIN
  -- Serialize chain inserts so concurrent transactions cannot fork the chain.
  PERFORM pg_advisory_xact_lock(982451653);

  -- Assign chain position under the lock so ordering matches committed order.
  NEW.chain_position := nextval('audit_chain_seq');

  SELECT event_hash
    INTO previous_hash
    FROM audit_event
   WHERE event_hash IS NOT NULL
   ORDER BY chain_position DESC
   LIMIT 1;

  IF previous_hash IS NULL THEN
    previous_hash := 'GENESIS';
  END IF;

  NEW.hash_version    := 1;
  NEW.prev_event_hash := previous_hash;

  -- Canonical payload: chain_position | event_type | entity_type | entity_id |
  --   actor_id | created_at (UTC ISO-8601) | prev_event_hash
  canonical_payload := concat_ws(
    '|',
    NEW.chain_position::text,
    COALESCE(NEW.event_type, ''),
    COALESCE(NEW.entity_type, ''),
    COALESCE(NEW.entity_id::text, ''),
    COALESCE(NEW.actor_id::text, ''),
    to_char(COALESCE(NEW.created_at, NOW()) AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    NEW.prev_event_hash
  );

  NEW.event_hash := encode(digest(canonical_payload, 'sha256'), 'hex');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_event_hash_chain ON audit_event;
CREATE TRIGGER trg_audit_event_hash_chain
BEFORE INSERT ON audit_event
FOR EACH ROW
EXECUTE FUNCTION set_audit_event_hash_chain();

-- ── Back-fill existing rows ─────────────────────────────────────────────────

DO $$
DECLARE
  rec              RECORD;
  running_prev_hash TEXT := 'GENESIS';
  canonical_payload TEXT;
  computed_hash    TEXT;
BEGIN
  PERFORM pg_advisory_lock(982451653);

  FOR rec IN
    SELECT audit_id, event_type, entity_type, entity_id, actor_id, created_at
    FROM audit_event
    ORDER BY created_at ASC, audit_id ASC
  LOOP
    UPDATE audit_event
       SET chain_position = nextval('audit_chain_seq')
     WHERE audit_id = rec.audit_id;

    canonical_payload := concat_ws(
      '|',
      currval('audit_chain_seq')::text,
      COALESCE(rec.event_type, ''),
      COALESCE(rec.entity_type, ''),
      COALESCE(rec.entity_id::text, ''),
      COALESCE(rec.actor_id::text, ''),
      to_char(rec.created_at AT TIME ZONE 'UTC',
              'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      running_prev_hash
    );
    computed_hash := encode(digest(canonical_payload, 'sha256'), 'hex');

    UPDATE audit_event
       SET prev_event_hash = running_prev_hash,
           event_hash      = computed_hash,
           hash_version    = 1
     WHERE audit_id = rec.audit_id;

    running_prev_hash := computed_hash;
  END LOOP;

  PERFORM pg_advisory_unlock(982451653);
END $$;

-- Reset sequence to highest assigned value.
SELECT setval(
  'audit_chain_seq',
  COALESCE((SELECT MAX(chain_position) FROM audit_event), 1),
  true
);

-- ── Immutability rules ──────────────────────────────────────────────────────
-- Prevent UPDATE and DELETE on audit_event — the chain must be append-only.

CREATE OR REPLACE RULE audit_event_no_update AS
  ON UPDATE TO audit_event DO INSTEAD NOTHING;
CREATE OR REPLACE RULE audit_event_no_delete AS
  ON DELETE TO audit_event DO INSTEAD NOTHING;

-- Prevent UPDATE and DELETE on custody_event — custody chain is immutable.

CREATE OR REPLACE RULE custody_event_no_update AS
  ON UPDATE TO custody_event DO INSTEAD NOTHING;
CREATE OR REPLACE RULE custody_event_no_delete AS
  ON DELETE TO custody_event DO INSTEAD NOTHING;
