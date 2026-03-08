-- Add missing columns to actor_account referenced by routes
ALTER TABLE actor_account ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE actor_account ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Backfill display_name from canonical_name where applicable
UPDATE actor_account SET display_name = canonical_name WHERE display_name IS NULL AND canonical_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_actor_active ON actor_account (is_active) WHERE is_active = TRUE;
