-- Enable pg_trgm extension for fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── tsvector columns ────────────────────────────────────────────────────────

ALTER TABLE sm_alert ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE case_record ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE content_item ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- ── GIN indexes on tsvector columns ─────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_sm_alert_search ON sm_alert USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_case_record_search ON case_record USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_content_item_search ON content_item USING GIN(search_vector);

-- ── Trigram indexes for fuzzy matching ──────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_sm_alert_desc_trgm ON sm_alert USING GIN(description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_case_record_desc_trgm ON case_record USING GIN(description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_content_item_text_trgm ON content_item USING GIN(content_text gin_trgm_ops);

-- ── Trigger function: update search_vector on INSERT / UPDATE ───────────────

CREATE OR REPLACE FUNCTION sm_alert_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION case_record_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION content_item_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.author_name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.content_text, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── Triggers ────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_sm_alert_search ON sm_alert;
CREATE TRIGGER trg_sm_alert_search
  BEFORE INSERT OR UPDATE ON sm_alert
  FOR EACH ROW EXECUTE FUNCTION sm_alert_search_vector_update();

DROP TRIGGER IF EXISTS trg_case_record_search ON case_record;
CREATE TRIGGER trg_case_record_search
  BEFORE INSERT OR UPDATE ON case_record
  FOR EACH ROW EXECUTE FUNCTION case_record_search_vector_update();

DROP TRIGGER IF EXISTS trg_content_item_search ON content_item;
CREATE TRIGGER trg_content_item_search
  BEFORE INSERT OR UPDATE ON content_item
  FOR EACH ROW EXECUTE FUNCTION content_item_search_vector_update();

-- ── Backfill existing rows ──────────────────────────────────────────────────

UPDATE sm_alert SET search_vector =
  setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(description, '')), 'B')
WHERE search_vector IS NULL;

UPDATE case_record SET search_vector =
  setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(description, '')), 'B')
WHERE search_vector IS NULL;

UPDATE content_item SET search_vector =
  setweight(to_tsvector('english', COALESCE(author_name, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(content_text, '')), 'B')
WHERE search_vector IS NULL;
