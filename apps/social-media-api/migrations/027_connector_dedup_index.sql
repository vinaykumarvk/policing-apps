-- Unique partial index to prevent duplicate ingestion of the same platform post
CREATE UNIQUE INDEX IF NOT EXISTS idx_content_platform_post_unique
  ON content_item (platform, platform_post_id)
  WHERE platform_post_id IS NOT NULL;
