-- FR-06: Extraction detail JSONB and language support
ALTER TABLE evidence_source ADD COLUMN IF NOT EXISTS extraction_detail JSONB;
ALTER TABLE evidence_source ADD COLUMN IF NOT EXISTS extraction_language VARCHAR(10) DEFAULT 'en';
