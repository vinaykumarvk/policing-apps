-- FR-02 AC-02 / FR-19: Content deduplication unique constraint
-- Prevents exact duplicate ingestion by (source_platform, md5(raw_text), captured_at)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_content_dedup'
  ) THEN
    ALTER TABLE content_item
      ADD CONSTRAINT uq_content_dedup UNIQUE (source_platform, content_hash);
  END IF;
END $$;

-- Add content_hash column if not exists
ALTER TABLE content_item ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- Populate content_hash for existing rows
UPDATE content_item SET content_hash = md5(raw_text) WHERE content_hash IS NULL;

-- Create function to auto-set content_hash on INSERT
CREATE OR REPLACE FUNCTION set_content_hash() RETURNS TRIGGER AS $$
BEGIN
  NEW.content_hash := md5(NEW.raw_text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_content_hash ON content_item;
CREATE TRIGGER trg_content_hash
  BEFORE INSERT ON content_item
  FOR EACH ROW EXECUTE FUNCTION set_content_hash();
