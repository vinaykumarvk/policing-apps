-- FR-05: Faceted search indexes for artifact_type, risk_band, date_range

CREATE INDEX IF NOT EXISTS idx_artifact_type_case ON artifact (artifact_type, case_id);
CREATE INDEX IF NOT EXISTS idx_artifact_case_created ON artifact (case_id, created_at);
CREATE INDEX IF NOT EXISTS idx_risk_score_band ON risk_score (risk_band) WHERE risk_band IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_risk_score_entity ON risk_score (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_classification_category ON classification_result (category);
CREATE INDEX IF NOT EXISTS idx_classification_entity ON classification_result (entity_type, entity_id);
