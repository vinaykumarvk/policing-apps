-- Enable pg_trgm extension for fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── tsvector columns ────────────────────────────────────────────────────────

ALTER TABLE alert ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE lead ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE subject_profile ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- ── GIN indexes on tsvector columns ─────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_alert_search ON alert USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_lead_search ON lead USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_subject_search ON subject_profile USING GIN(search_vector);

-- ── Trigram indexes for fuzzy matching ──────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_alert_desc_trgm ON alert USING GIN(description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_lead_summary_trgm ON lead USING GIN(summary gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_subject_name_trgm ON subject_profile USING GIN(full_name gin_trgm_ops);

-- ── Trigger function: update search_vector on INSERT / UPDATE ───────────────

CREATE OR REPLACE FUNCTION alert_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION lead_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.summary, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.details, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION subject_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.full_name, '')), 'A');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── Triggers ────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_alert_search ON alert;
CREATE TRIGGER trg_alert_search
  BEFORE INSERT OR UPDATE ON alert
  FOR EACH ROW EXECUTE FUNCTION alert_search_vector_update();

DROP TRIGGER IF EXISTS trg_lead_search ON lead;
CREATE TRIGGER trg_lead_search
  BEFORE INSERT OR UPDATE ON lead
  FOR EACH ROW EXECUTE FUNCTION lead_search_vector_update();

DROP TRIGGER IF EXISTS trg_subject_search ON subject_profile;
CREATE TRIGGER trg_subject_search
  BEFORE INSERT OR UPDATE ON subject_profile
  FOR EACH ROW EXECUTE FUNCTION subject_search_vector_update();

-- ── Backfill existing rows ──────────────────────────────────────────────────

UPDATE alert SET search_vector =
  setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(description, '')), 'B')
WHERE search_vector IS NULL;

UPDATE lead SET search_vector =
  setweight(to_tsvector('english', COALESCE(summary, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(details, '')), 'B')
WHERE search_vector IS NULL;

UPDATE subject_profile SET search_vector =
  setweight(to_tsvector('english', COALESCE(full_name, '')), 'A')
WHERE search_vector IS NULL;
