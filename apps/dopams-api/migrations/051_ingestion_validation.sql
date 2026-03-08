-- FR-02 AC-02: Ingestion format validation report
ALTER TABLE ingestion_job ADD COLUMN IF NOT EXISTS validation_report JSONB;
