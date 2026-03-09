-- Add pipeline_metadata JSONB column to classification_result
-- Stores intermediate pipeline breakdown: normalized text, keywords, slang matches,
-- emoji codes, transaction signals, narcotics score components, processing time.
ALTER TABLE classification_result
  ADD COLUMN IF NOT EXISTS pipeline_metadata JSONB DEFAULT '{}'::jsonb;
