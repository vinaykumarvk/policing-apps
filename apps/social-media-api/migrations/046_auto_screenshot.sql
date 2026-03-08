-- Indexes for efficient evidence lookup by capture type and content
CREATE INDEX IF NOT EXISTS idx_evidence_capture_type ON evidence_item(capture_type);
CREATE INDEX IF NOT EXISTS idx_evidence_content_id ON evidence_item(content_id);
