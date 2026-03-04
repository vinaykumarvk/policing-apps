-- Enable pg_trgm extension for fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── tsvector columns ────────────────────────────────────────────────────────

ALTER TABLE forensic_case ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE ai_finding ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- ── GIN indexes on tsvector columns ─────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_forensic_case_search ON forensic_case USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_ai_finding_search ON ai_finding USING GIN(search_vector);

-- ── Trigram indexes for fuzzy matching ──────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_forensic_case_desc_trgm ON forensic_case USING GIN(description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_ai_finding_desc_trgm ON ai_finding USING GIN(description gin_trgm_ops);

-- ── Trigger function: update search_vector on INSERT / UPDATE ───────────────

CREATE OR REPLACE FUNCTION forensic_case_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION ai_finding_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── Triggers ────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_forensic_case_search ON forensic_case;
CREATE TRIGGER trg_forensic_case_search
  BEFORE INSERT OR UPDATE ON forensic_case
  FOR EACH ROW EXECUTE FUNCTION forensic_case_search_vector_update();

DROP TRIGGER IF EXISTS trg_ai_finding_search ON ai_finding;
CREATE TRIGGER trg_ai_finding_search
  BEFORE INSERT OR UPDATE ON ai_finding
  FOR EACH ROW EXECUTE FUNCTION ai_finding_search_vector_update();

-- ── Backfill existing rows ──────────────────────────────────────────────────

UPDATE forensic_case SET search_vector =
  setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(description, '')), 'B')
WHERE search_vector IS NULL;

UPDATE ai_finding SET search_vector =
  setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(description, '')), 'B')
WHERE search_vector IS NULL;
