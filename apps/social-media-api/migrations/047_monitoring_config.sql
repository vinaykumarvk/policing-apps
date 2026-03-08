-- Tier-1: Monitored profiles / groups / pages
CREATE TABLE IF NOT EXISTS monitoring_profile (
  profile_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform          VARCHAR(64) NOT NULL CHECK (platform IN ('facebook', 'instagram', 'twitter', 'x')),
  entry_type        VARCHAR(32) NOT NULL DEFAULT 'PROFILE' CHECK (entry_type IN ('PROFILE', 'GROUP', 'PAGE')),
  handle            VARCHAR(256),
  url               TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  priority          VARCHAR(16) NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('HIGH', 'NORMAL', 'LOW')),
  last_scraped_at   TIMESTAMPTZ,
  created_by        UUID REFERENCES user_account(user_id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT monitoring_profile_handle_or_url CHECK (handle IS NOT NULL OR url IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_monitoring_profile_platform_handle
  ON monitoring_profile (platform, handle) WHERE handle IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_monitoring_profile_platform_url
  ON monitoring_profile (platform, url) WHERE url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_monitoring_profile_active
  ON monitoring_profile (is_active) WHERE is_active = TRUE;

-- Tier-2: Jurisdiction locations for post-filtering
CREATE TABLE IF NOT EXISTS jurisdiction_location (
  location_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_name     VARCHAR(256) NOT NULL UNIQUE,
  city_names        JSONB NOT NULL DEFAULT '[]',
  area_names        JSONB NOT NULL DEFAULT '[]',
  alt_spellings     JSONB NOT NULL DEFAULT '[]',
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  notes             TEXT,
  created_by        UUID REFERENCES user_account(user_id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jurisdiction_location_active
  ON jurisdiction_location (is_active) WHERE is_active = TRUE;

-- Add apify connector to source_connector seed
INSERT INTO source_connector (platform, base_url, is_active, health_status)
VALUES ('apify', 'https://api.apify.com/v2', TRUE, 'UNKNOWN')
ON CONFLICT DO NOTHING;
