CREATE TABLE IF NOT EXISTS dopams_field_mapping (
  mapping_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_field VARCHAR(128) NOT NULL,
  target_field VARCHAR(128) NOT NULL,
  transform_fn VARCHAR(64),
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_dopams_field_mapping_active ON dopams_field_mapping (source_field, target_field) WHERE is_active = TRUE;
