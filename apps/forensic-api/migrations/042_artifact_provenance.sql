-- FR-03: Artifact provenance — parser version and source tool tracking
ALTER TABLE artifact ADD COLUMN IF NOT EXISTS parser_version VARCHAR(20);
ALTER TABLE artifact ADD COLUMN IF NOT EXISTS source_tool VARCHAR(100);
