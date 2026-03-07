-- FR-07: Analysis source enum on findings
ALTER TABLE ai_finding ADD COLUMN IF NOT EXISTS analysis_source VARCHAR(20) DEFAULT 'MANUAL';
