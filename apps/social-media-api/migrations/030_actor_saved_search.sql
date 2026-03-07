-- FR-04: Actor aggregation, saved searches

CREATE TABLE IF NOT EXISTS actor_account (
  actor_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name TEXT,
  handles JSONB NOT NULL DEFAULT '[]'::jsonb,
  platforms JSONB NOT NULL DEFAULT '[]'::jsonb,
  risk_score NUMERIC(5,2) DEFAULT 0,
  total_flagged_posts INTEGER DEFAULT 0,
  is_repeat_offender BOOLEAN DEFAULT FALSE,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  metadata_jsonb JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS saved_search (
  search_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_name TEXT NOT NULL,
  query_jsonb JSONB NOT NULL,
  owner_id UUID NOT NULL,
  alert_on_match BOOLEAN DEFAULT FALSE,
  last_run_at TIMESTAMPTZ,
  match_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link content items to actors
ALTER TABLE content_item ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES actor_account(actor_id);

CREATE INDEX IF NOT EXISTS idx_actor_handles ON actor_account USING gin (handles);
CREATE INDEX IF NOT EXISTS idx_actor_risk ON actor_account (risk_score DESC) WHERE risk_score > 0;
CREATE INDEX IF NOT EXISTS idx_actor_repeat ON actor_account (is_repeat_offender) WHERE is_repeat_offender = TRUE;
CREATE INDEX IF NOT EXISTS idx_saved_search_owner ON saved_search (owner_id);
CREATE INDEX IF NOT EXISTS idx_content_actor ON content_item (actor_id) WHERE actor_id IS NOT NULL;
