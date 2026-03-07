-- FR-02: Format validation, checksum dedup on upload, immutable storage flag
ALTER TABLE evidence_item ADD COLUMN IF NOT EXISTS storage_immutable BOOLEAN DEFAULT TRUE;
