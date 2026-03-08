-- FR-03 AC-03/04: Parser version and artifact type tracking
ALTER TABLE artifact ADD COLUMN IF NOT EXISTS parser_version TEXT;
ALTER TABLE artifact ADD COLUMN IF NOT EXISTS artifact_type TEXT;
