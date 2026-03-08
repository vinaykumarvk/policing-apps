-- Add source provenance columns to monitoring_profile
ALTER TABLE monitoring_profile
  ADD COLUMN IF NOT EXISTS source       VARCHAR(32) NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS source_ref   VARCHAR(256),
  ADD COLUMN IF NOT EXISTS suspect_name VARCHAR(256),
  ADD COLUMN IF NOT EXISTS notes        TEXT;

DO $$ BEGIN
  ALTER TABLE monitoring_profile
    ADD CONSTRAINT chk_monitoring_source
    CHECK (source IN ('MANUAL','NIDAAN','TEF','PRIVATE','BULK_CSV'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_monitoring_source ON monitoring_profile(source);
