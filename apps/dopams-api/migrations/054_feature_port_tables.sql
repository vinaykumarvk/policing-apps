-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 054: Feature Port Tables from Social Media App
-- Adds tables and columns needed for evidence legal hold, access
-- justification, legal mapping rules, slang/emoji detection, trend
-- analysis, saved searches, escalation, alert sharing, and glossary.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. evidence_legal_hold ──────────────────────────────────────────────────
-- Tracks legal holds placed on evidence items (ISO 27037 compliance)

CREATE TABLE IF NOT EXISTS evidence_legal_hold (
  hold_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_id     UUID NOT NULL REFERENCES evidence_item(evidence_id),
  hold_reason     TEXT NOT NULL,
  legal_reference TEXT,
  held_by         UUID NOT NULL REFERENCES user_account(user_id),
  released_by     UUID REFERENCES user_account(user_id),
  released_at     TIMESTAMPTZ,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evidence_legal_hold_evidence
  ON evidence_legal_hold(evidence_id);
CREATE INDEX IF NOT EXISTS idx_evidence_legal_hold_active
  ON evidence_legal_hold(evidence_id) WHERE is_active = TRUE;

-- ── 2. access_justification ────────────────────────────────────────────────
-- Records justification when users access sensitive entities (tiered access)

CREATE TABLE IF NOT EXISTS access_justification (
  justification_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES user_account(user_id),
  entity_type       VARCHAR(64) NOT NULL,
  entity_id         UUID NOT NULL,
  justification_type VARCHAR(32) NOT NULL
    CHECK (justification_type IN ('CASE_LINKED', 'SUPERVISOR_OVERRIDE', 'EMERGENCY', 'AUDIT_REVIEW')),
  reason_text       TEXT NOT NULL,
  supervisor_id     UUID REFERENCES user_account(user_id),
  reviewed_at       TIMESTAMPTZ,
  status            VARCHAR(16) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED')),
  unit_id           UUID REFERENCES organization_unit(unit_id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_access_justification_user
  ON access_justification(user_id);
CREATE INDEX IF NOT EXISTS idx_access_justification_entity
  ON access_justification(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_access_justification_status
  ON access_justification(status) WHERE status = 'PENDING';

-- ── 3. legal_mapping_rule ──────────────────────────────────────────────────
-- Rule-based legal section mapping engine with governance workflow

CREATE TABLE IF NOT EXISTS legal_mapping_rule (
  rule_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_code         VARCHAR(50) NOT NULL UNIQUE,
  name              VARCHAR(200) NOT NULL,
  description       TEXT,
  expression_jsonb  JSONB NOT NULL DEFAULT '{}'::jsonb,
  target_sections   TEXT[] DEFAULT '{}',
  severity_weight   NUMERIC(5,2) NOT NULL DEFAULT 1.0,
  status            VARCHAR(30) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'PUBLISHED', 'REJECTED', 'SUPERSEDED', 'ROLLED_BACK')),
  version           INTEGER NOT NULL DEFAULT 1,
  superseded_by     UUID REFERENCES legal_mapping_rule(rule_id),
  created_by        UUID REFERENCES user_account(user_id),
  approved_by       UUID REFERENCES user_account(user_id),
  published_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_legal_mapping_rule_status
  ON legal_mapping_rule(status);
CREATE INDEX IF NOT EXISTS idx_legal_mapping_rule_code
  ON legal_mapping_rule(rule_code);

-- Link legal_mapping rows to rules (if legal_mapping table exists from 011)
ALTER TABLE legal_mapping ADD COLUMN IF NOT EXISTS rule_id UUID REFERENCES legal_mapping_rule(rule_id);
ALTER TABLE legal_mapping ADD COLUMN IF NOT EXISTS provision_code VARCHAR(100);
ALTER TABLE legal_mapping ADD COLUMN IF NOT EXISTS rationale_text TEXT;
ALTER TABLE legal_mapping ADD COLUMN IF NOT EXISTS confidence_score NUMERIC(5,2);
ALTER TABLE legal_mapping ADD COLUMN IF NOT EXISTS reviewer_status VARCHAR(20) DEFAULT 'PENDING';
ALTER TABLE legal_mapping ADD COLUMN IF NOT EXISTS reviewed_by UUID;
ALTER TABLE legal_mapping ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_legal_mapping_rule_ref
  ON legal_mapping(rule_id);
CREATE INDEX IF NOT EXISTS idx_legal_mapping_reviewer
  ON legal_mapping(reviewer_status);

-- ── 4. slang_dictionary ────────────────────────────────────────────────────
-- Multilingual slang/keyword/emoji detection dictionary

CREATE TABLE IF NOT EXISTS slang_dictionary (
  slang_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  term              TEXT NOT NULL,
  canonical_form    TEXT NOT NULL,
  romanized_form    TEXT,
  category          TEXT NOT NULL,
  language          TEXT DEFAULT 'en',
  term_type         VARCHAR(20) NOT NULL DEFAULT 'SLANG'
    CHECK (term_type IN ('SLANG', 'KEYWORD', 'EMOJI')),
  submission_status VARCHAR(16) NOT NULL DEFAULT 'APPROVED'
    CHECK (submission_status IN ('PENDING', 'APPROVED', 'REJECTED')),
  risk_weight       NUMERIC(3,2) DEFAULT 1.0,
  submitted_by      UUID REFERENCES user_account(user_id),
  reviewed_by       UUID REFERENCES user_account(user_id),
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (term, language)
);

CREATE INDEX IF NOT EXISTS idx_slang_term
  ON slang_dictionary(term) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_slang_category
  ON slang_dictionary(category) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_slang_language
  ON slang_dictionary(language);
CREATE INDEX IF NOT EXISTS idx_slang_term_type
  ON slang_dictionary(term_type) WHERE is_active = TRUE;

-- Enable pg_trgm if not already enabled (for fuzzy matching)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_slang_romanized_trgm
  ON slang_dictionary USING GIN (romanized_form gin_trgm_ops)
  WHERE romanized_form IS NOT NULL;

-- Seed sample slang entries
INSERT INTO slang_dictionary (term, canonical_form, language, category, risk_weight, romanized_form) VALUES
  ('maal',    'drugs',              'hi', 'NARCOTICS',       1.5, 'maal'),
  ('chitta',  'heroin',             'pa', 'NARCOTICS',       2.0, 'chitta'),
  ('pudiya',  'drug packet',        'hi', 'NARCOTICS',       1.8, 'pudiya'),
  ('supari',  'contract killing',   'hi', 'VIOLENCE',        2.5, 'supari'),
  ('hafta',   'extortion payment',  'hi', 'EXTORTION',       2.0, 'hafta'),
  ('jugaad',  'illicit arrangement','hi', 'FRAUD',           1.0, 'jugaad'),
  ('katta',   'country-made pistol','hi', 'WEAPONS',         2.5, 'katta'),
  ('nasha',   'intoxicant',         'hi', 'NARCOTICS',       1.2, 'nasha'),
  ('toli',    'gang',               'hi', 'ORGANIZED_CRIME', 1.5, 'toli'),
  ('setting', 'bribery arrangement','hi', 'CORRUPTION',      1.8, 'setting')
ON CONFLICT (term, language) DO NOTHING;

-- ── 5. emoji_drug_code ─────────────────────────────────────────────────────
-- Reference table mapping emojis to drug categories (DEA guide)

CREATE TABLE IF NOT EXISTS emoji_drug_code (
  emoji_code_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emoji           TEXT NOT NULL,
  meaning         TEXT,
  drug_category   TEXT NOT NULL,
  risk_weight     NUMERIC(3,2) NOT NULL DEFAULT 1.0,
  signal_type     TEXT NOT NULL DEFAULT 'SUBSTANCE'
    CHECK (signal_type IN ('SUBSTANCE', 'TRANSACTION', 'QUALITY')),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_emoji_drug_code_emoji
  ON emoji_drug_code(emoji);
CREATE INDEX IF NOT EXISTS idx_emoji_drug_code_active
  ON emoji_drug_code(is_active) WHERE is_active = TRUE;

-- Seed emoji drug codes (DEA published guide mappings)
INSERT INTO emoji_drug_code (emoji, meaning, drug_category, risk_weight, signal_type) VALUES
  ('❄️',  'Snowflake — cocaine',                           'COCAINE',       2.0, 'SUBSTANCE'),
  ('⛷️',  'Skier — cocaine use',                           'COCAINE',       1.5, 'SUBSTANCE'),
  ('💎',  'Diamond — crystal meth',                        'METH',          2.0, 'SUBSTANCE'),
  ('🧊',  'Ice cube — crystal meth/ice',                   'METH',          2.0, 'SUBSTANCE'),
  ('💊',  'Pill — prescription drugs/MDMA/fentanyl pills', 'PILLS',         2.0, 'SUBSTANCE'),
  ('🍁',  'Maple leaf — marijuana',                        'CANNABIS',      1.5, 'SUBSTANCE'),
  ('🌿',  'Herb — marijuana',                              'CANNABIS',      1.5, 'SUBSTANCE'),
  ('🍃',  'Leaf — marijuana',                              'CANNABIS',      1.5, 'SUBSTANCE'),
  ('🐉',  'Dragon — chasing the dragon/heroin',            'HEROIN',        2.0, 'SUBSTANCE'),
  ('🥄',  'Spoon — heroin preparation',                    'HEROIN',        1.5, 'SUBSTANCE'),
  ('💀',  'Skull — fentanyl/deadly potency',               'FENTANYL',      2.5, 'SUBSTANCE'),
  ('☠️',  'Skull and crossbones — fentanyl',               'FENTANYL',      2.5, 'SUBSTANCE'),
  ('💜',  'Purple heart — lean/purple drank',              'LEAN',          1.5, 'SUBSTANCE'),
  ('🍄',  'Mushroom — psilocybin mushrooms',               'PSYCHEDELICS',  1.5, 'SUBSTANCE'),
  ('🔌',  'Plug — drug dealer/connection',                 'TRANSACTION',   2.0, 'TRANSACTION'),
  ('📦',  'Package — drug shipment',                       'TRANSACTION',   1.5, 'TRANSACTION'),
  ('💸',  'Money with wings — payment',                    'TRANSACTION',   1.5, 'TRANSACTION'),
  ('🔥',  'Fire — potent/high quality',                    'QUALITY',       1.5, 'QUALITY'),
  ('💣',  'Bomb — very potent',                            'QUALITY',       1.5, 'QUALITY'),
  ('💯',  'Hundred — pure/uncut',                          'QUALITY',       1.0, 'QUALITY')
ON CONFLICT (emoji) DO NOTHING;

-- ── 6. trend_detection ─────────────────────────────────────────────────────
-- Aggregated detection counts in time buckets for trend analysis

CREATE TABLE IF NOT EXISTS trend_detection (
  trend_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  term_type         TEXT NOT NULL,
  term_value        TEXT NOT NULL,
  category          TEXT,
  detection_count   INTEGER NOT NULL DEFAULT 1,
  window_start      TIMESTAMPTZ NOT NULL,
  window_end        TIMESTAMPTZ NOT NULL,
  unit_id           UUID REFERENCES organization_unit(unit_id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_trend_detection_unique
  ON trend_detection(term_type, term_value, window_start, unit_id);
CREATE INDEX IF NOT EXISTS idx_trend_detection_window
  ON trend_detection(window_start DESC);
CREATE INDEX IF NOT EXISTS idx_trend_detection_unit
  ON trend_detection(unit_id) WHERE unit_id IS NOT NULL;

-- ── 7. trend_spike_alert ───────────────────────────────────────────────────
-- Records when a term exceeds its baseline detection rate

CREATE TABLE IF NOT EXISTS trend_spike_alert (
  spike_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  term_type         TEXT NOT NULL,
  term_value        TEXT NOT NULL,
  baseline_count    NUMERIC NOT NULL,
  spike_count       INTEGER NOT NULL,
  spike_ratio       NUMERIC NOT NULL,
  time_window       TEXT NOT NULL DEFAULT '1h',
  acknowledged_by   UUID REFERENCES user_account(user_id),
  acknowledged_at   TIMESTAMPTZ,
  unit_id           UUID REFERENCES organization_unit(unit_id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trend_spike_unacked
  ON trend_spike_alert(acknowledged_by) WHERE acknowledged_by IS NULL;
CREATE INDEX IF NOT EXISTS idx_trend_spike_unit
  ON trend_spike_alert(unit_id) WHERE unit_id IS NOT NULL;

-- ── 8. nps_candidate ───────────────────────────────────────────────────────
-- New Psychoactive Substance candidates detected by the system (UNODC EWA)

CREATE TABLE IF NOT EXISTS nps_candidate (
  nps_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  term              TEXT NOT NULL,
  first_seen_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  detection_count   INTEGER NOT NULL DEFAULT 1,
  context_snippet   TEXT,
  source_entity_ids UUID[] DEFAULT '{}',
  status            TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'CONFIRMED_NPS', 'DISMISSED', 'FALSE_POSITIVE', 'KNOWN_SUBSTANCE')),
  reviewed_by       UUID REFERENCES user_account(user_id),
  reviewed_at       TIMESTAMPTZ,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nps_candidate_status
  ON nps_candidate(status);
CREATE INDEX IF NOT EXISTS idx_nps_candidate_term
  ON nps_candidate(term);

-- ── 9. saved_search ────────────────────────────────────────────────────────
-- User-saved search queries with optional alert-on-match

CREATE TABLE IF NOT EXISTS saved_search (
  search_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES user_account(user_id),
  name              TEXT NOT NULL,
  query_text        TEXT,
  filters_jsonb     JSONB DEFAULT '{}'::jsonb,
  alert_on_match    BOOLEAN DEFAULT FALSE,
  last_run_at       TIMESTAMPTZ,
  match_count       INTEGER DEFAULT 0,
  is_active         BOOLEAN DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_search_user
  ON saved_search(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_search_active
  ON saved_search(user_id) WHERE is_active = TRUE;

-- ── 10. escalation_request ─────────────────────────────────────────────────
-- Alert escalation approval workflow

CREATE TABLE IF NOT EXISTS escalation_request (
  escalation_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id          UUID NOT NULL REFERENCES alert(alert_id),
  requested_by      UUID NOT NULL REFERENCES user_account(user_id),
  approved_by       UUID REFERENCES user_account(user_id),
  status            VARCHAR(16) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  reason            TEXT NOT NULL,
  decision_reason   TEXT,
  unit_id           UUID REFERENCES organization_unit(unit_id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escalation_request_alert
  ON escalation_request(alert_id);
CREATE INDEX IF NOT EXISTS idx_escalation_request_status
  ON escalation_request(status) WHERE status = 'PENDING';

-- ── 11. alert_share ────────────────────────────────────────────────────────
-- Records when alerts are shared internally or with external agencies

CREATE TABLE IF NOT EXISTS alert_share (
  share_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id          UUID NOT NULL REFERENCES alert(alert_id),
  shared_by         UUID NOT NULL REFERENCES user_account(user_id),
  share_type        TEXT NOT NULL
    CHECK (share_type IN ('INTERNAL', 'EXTERNAL_AGENCY', 'PLATFORM_REPORT')),
  recipient         TEXT NOT NULL,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_share_alert
  ON alert_share(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_share_type
  ON alert_share(share_type);

-- ── 12. glossary_term ──────────────────────────────────────────────────────
-- Bilingual glossary for translation standardization

CREATE TABLE IF NOT EXISTS glossary_term (
  glossary_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_lang       VARCHAR(8) NOT NULL,
  target_lang       VARCHAR(8) NOT NULL,
  source_term       TEXT NOT NULL,
  target_term       TEXT NOT NULL,
  domain            TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_lang, target_lang, source_term)
);

CREATE INDEX IF NOT EXISTS idx_glossary_term_lookup
  ON glossary_term(source_lang, target_lang) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_glossary_term_domain
  ON glossary_term(domain) WHERE domain IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- Column additions to existing DOPAMS tables
-- ═══════════════════════════════════════════════════════════════════════════

-- ── evidence_item additions ────────────────────────────────────────────────
-- legal_hold already exists from 040_evidence_coc.sql

ALTER TABLE evidence_item ADD COLUMN IF NOT EXISTS is_original BOOLEAN DEFAULT TRUE;
ALTER TABLE evidence_item ADD COLUMN IF NOT EXISTS parent_evidence_id UUID REFERENCES evidence_item(evidence_id);
ALTER TABLE evidence_item ADD COLUMN IF NOT EXISTS capture_method TEXT;
ALTER TABLE evidence_item ADD COLUMN IF NOT EXISTS osint_metadata_jsonb JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_evidence_item_parent
  ON evidence_item(parent_evidence_id) WHERE parent_evidence_id IS NOT NULL;

-- ── alert additions ────────────────────────────────────────────────────────

ALTER TABLE alert ADD COLUMN IF NOT EXISTS priority_queue TEXT;
ALTER TABLE alert ADD COLUMN IF NOT EXISTS false_positive_reason TEXT;
ALTER TABLE alert ADD COLUMN IF NOT EXISTS converted_case_id UUID REFERENCES dopams_case(case_id);

CREATE INDEX IF NOT EXISTS idx_alert_priority_queue
  ON alert(priority_queue) WHERE priority_queue IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_alert_converted_case
  ON alert(converted_case_id) WHERE converted_case_id IS NOT NULL;

-- ── classification_result additions ────────────────────────────────────────

ALTER TABLE classification_result ADD COLUMN IF NOT EXISTS pipeline_metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE classification_result ADD COLUMN IF NOT EXISTS review_status TEXT DEFAULT 'PENDING';
ALTER TABLE classification_result ADD COLUMN IF NOT EXISTS review_recommended BOOLEAN DEFAULT FALSE;
ALTER TABLE classification_result ADD COLUMN IF NOT EXISTS confidence_band TEXT;

CREATE INDEX IF NOT EXISTS idx_classification_review_status
  ON classification_result(review_status) WHERE review_status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_classification_confidence_band
  ON classification_result(confidence_band) WHERE confidence_band IS NOT NULL;
