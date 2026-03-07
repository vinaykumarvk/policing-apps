-- FR-16: Add BRD-required lead fields: channel, informant, urgency, dedup, auto-memo

ALTER TABLE lead ADD COLUMN IF NOT EXISTS channel TEXT;
ALTER TABLE lead ADD COLUMN IF NOT EXISTS informant_name TEXT;
ALTER TABLE lead ADD COLUMN IF NOT EXISTS informant_contact TEXT;
ALTER TABLE lead ADD COLUMN IF NOT EXISTS urgency TEXT DEFAULT 'NORMAL'
  CHECK (urgency IN ('LOW', 'NORMAL', 'HIGH', 'CRITICAL'));
ALTER TABLE lead ADD COLUMN IF NOT EXISTS duplicate_of_lead_id UUID REFERENCES lead(lead_id);
ALTER TABLE lead ADD COLUMN IF NOT EXISTS auto_memo_generated BOOLEAN DEFAULT FALSE;
ALTER TABLE lead ADD COLUMN IF NOT EXISTS source_document_id UUID;
ALTER TABLE lead ADD COLUMN IF NOT EXISTS geo_latitude NUMERIC(10,7);
ALTER TABLE lead ADD COLUMN IF NOT EXISTS geo_longitude NUMERIC(10,7);

CREATE INDEX IF NOT EXISTS idx_lead_channel ON lead (channel) WHERE channel IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lead_urgency ON lead (urgency);
CREATE INDEX IF NOT EXISTS idx_lead_duplicate ON lead (duplicate_of_lead_id) WHERE duplicate_of_lead_id IS NOT NULL;
