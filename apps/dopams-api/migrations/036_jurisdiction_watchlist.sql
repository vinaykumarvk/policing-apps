-- FR-01: Multi-level jurisdiction hierarchy, unit CRUD
-- FR-13: Watchlist management

-- Jurisdiction hierarchy
ALTER TABLE organization_unit ADD COLUMN IF NOT EXISTS unit_type TEXT
  CHECK (unit_type IN ('STATE', 'ZONE', 'DISTRICT', 'POLICE_STATION', 'UNIT'));
ALTER TABLE organization_unit ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 0;
ALTER TABLE organization_unit ADD COLUMN IF NOT EXISTS path TEXT;

-- Jurisdiction cache for fast hierarchy lookups
CREATE TABLE IF NOT EXISTS jurisdiction_cache (
  unit_id UUID PRIMARY KEY,
  ancestor_ids UUID[] NOT NULL DEFAULT '{}',
  descendant_ids UUID[] NOT NULL DEFAULT '{}',
  refreshed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Watchlist management
CREATE TABLE IF NOT EXISTS watchlist (
  watchlist_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  watchlist_name TEXT NOT NULL,
  description TEXT,
  subject_ids UUID[] DEFAULT '{}',
  criteria JSONB DEFAULT '{}'::jsonb,
  alert_on_activity BOOLEAN DEFAULT TRUE,
  owner_id UUID NOT NULL,
  unit_id UUID,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS watchlist_subject (
  watchlist_id UUID NOT NULL REFERENCES watchlist(watchlist_id),
  subject_id UUID NOT NULL REFERENCES subject_profile(subject_id),
  added_by UUID NOT NULL,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  PRIMARY KEY (watchlist_id, subject_id)
);

-- Refresh jurisdiction cache via recursive CTE
CREATE OR REPLACE FUNCTION refresh_jurisdiction_cache() RETURNS void AS $$
BEGIN
  -- Clear and rebuild
  DELETE FROM jurisdiction_cache;

  -- Insert ancestors for each unit
  INSERT INTO jurisdiction_cache (unit_id, ancestor_ids, descendant_ids)
  SELECT
    u.unit_id,
    COALESCE(
      (WITH RECURSIVE ancestors AS (
        SELECT parent_id, parent_id AS ancestor_id FROM organization_unit WHERE unit_id = u.unit_id
        UNION ALL
        SELECT o.parent_id, o.unit_id FROM organization_unit o JOIN ancestors a ON o.unit_id = a.parent_id WHERE o.parent_id IS NOT NULL
      ) SELECT array_agg(ancestor_id) FROM ancestors WHERE ancestor_id IS NOT NULL),
      '{}'::uuid[]
    ),
    COALESCE(
      (WITH RECURSIVE descendants AS (
        SELECT unit_id AS desc_id FROM organization_unit WHERE parent_id = u.unit_id
        UNION ALL
        SELECT o.unit_id FROM organization_unit o JOIN descendants d ON o.parent_id = d.desc_id
      ) SELECT array_agg(desc_id) FROM descendants),
      '{}'::uuid[]
    )
  FROM organization_unit u;
END;
$$ LANGUAGE plpgsql;

CREATE INDEX IF NOT EXISTS idx_org_unit_type ON organization_unit (unit_type) WHERE unit_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_org_unit_path ON organization_unit (path) WHERE path IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_watchlist_owner ON watchlist (owner_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_active ON watchlist (is_active) WHERE is_active = TRUE;
