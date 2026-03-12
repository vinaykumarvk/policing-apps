-- Migration 056: Entity Layer — Core normalized entity tables
-- Extracts phone numbers and identity documents from JSONB arrays into proper tables
-- Enables normalized matching for dedup (FR-25) and graph linking (FR-11)

-- ─── Phone Number ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS phone_number (
  phone_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_value        VARCHAR(30) NOT NULL,
  normalized_value VARCHAR(15) NOT NULL,
  phone_type       VARCHAR(20) DEFAULT 'MOBILE'
    CHECK (phone_type IN ('MOBILE', 'LANDLINE', 'UNKNOWN')),
  carrier          VARCHAR(100),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_phone_normalized ON phone_number(normalized_value);

-- ─── Identity Document ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS identity_document (
  document_pk      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type    VARCHAR(30) NOT NULL
    CHECK (document_type IN ('AADHAAR', 'PAN', 'PASSPORT', 'DRIVING_LICENSE', 'VOTER_ID', 'OTHER')),
  document_value   VARCHAR(100) NOT NULL,
  normalized_value VARCHAR(100) NOT NULL,
  is_verified      BOOLEAN DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_identity_doc_normalized ON identity_document(document_type, normalized_value);

-- ─── Subject–Phone Link ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subject_phone_link (
  link_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id     UUID NOT NULL REFERENCES subject_profile(subject_id) ON DELETE CASCADE,
  phone_id       UUID NOT NULL REFERENCES phone_number(phone_id) ON DELETE CASCADE,
  relationship   VARCHAR(30) NOT NULL DEFAULT 'OWNER'
    CHECK (relationship IN ('OWNER', 'USER', 'CONTACT', 'ASSOCIATE', 'SUSPECTED')),
  confidence     NUMERIC(5,2) DEFAULT 100 CHECK (confidence BETWEEN 0 AND 100),
  effective_from DATE,
  effective_to   DATE,
  source_system  VARCHAR(50),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spl_subject ON subject_phone_link(subject_id);
CREATE INDEX IF NOT EXISTS idx_spl_phone ON subject_phone_link(phone_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_spl_unique ON subject_phone_link(subject_id, phone_id, relationship);

-- ─── Subject–Identity Link ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subject_identity_link (
  link_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id   UUID NOT NULL REFERENCES subject_profile(subject_id) ON DELETE CASCADE,
  document_pk  UUID NOT NULL REFERENCES identity_document(document_pk) ON DELETE CASCADE,
  confidence   NUMERIC(5,2) DEFAULT 100 CHECK (confidence BETWEEN 0 AND 100),
  source_system VARCHAR(50),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sil_subject ON subject_identity_link(subject_id);
CREATE INDEX IF NOT EXISTS idx_sil_document ON subject_identity_link(document_pk);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sil_unique ON subject_identity_link(subject_id, document_pk);

-- ─── Subject–Subject Link ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subject_subject_link (
  link_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id_a   UUID NOT NULL REFERENCES subject_profile(subject_id) ON DELETE CASCADE,
  subject_id_b   UUID NOT NULL REFERENCES subject_profile(subject_id) ON DELETE CASCADE,
  relationship   VARCHAR(30) NOT NULL
    CHECK (relationship IN ('ASSOCIATE', 'FAMILY', 'GANG', 'CO_ACCUSED', 'SUPPLIER', 'BUYER', 'UNKNOWN')),
  strength       NUMERIC(5,2) DEFAULT 50 CHECK (strength BETWEEN 0 AND 100),
  evidence_count INTEGER DEFAULT 0,
  source_system  VARCHAR(50),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (subject_id_a < subject_id_b)
);

CREATE INDEX IF NOT EXISTS idx_ssl_a ON subject_subject_link(subject_id_a);
CREATE INDEX IF NOT EXISTS idx_ssl_b ON subject_subject_link(subject_id_b);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ssl_unique ON subject_subject_link(subject_id_a, subject_id_b, relationship);

-- ─── Document–Entity Link (extraction provenance) ──────────────────────────────
CREATE TABLE IF NOT EXISTS document_entity_link (
  link_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id       UUID NOT NULL,
  entity_type       VARCHAR(30) NOT NULL,
  entity_id         UUID NOT NULL,
  extraction_method VARCHAR(30) DEFAULT 'MANUAL'
    CHECK (extraction_method IN ('MANUAL', 'REGEX', 'NER', 'OCR', 'AI_EXTRACTION')),
  confidence        NUMERIC(5,2) DEFAULT 100 CHECK (confidence BETWEEN 0 AND 100),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_del_document ON document_entity_link(document_id);
CREATE INDEX IF NOT EXISTS idx_del_entity ON document_entity_link(entity_type, entity_id);
