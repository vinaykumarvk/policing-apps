-- Entity Extraction & Link Analysis tables for DOPAMS app

CREATE TABLE IF NOT EXISTS extracted_entity (
  extracted_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_entity_type TEXT NOT NULL,
  source_entity_id UUID NOT NULL,
  entity_type TEXT NOT NULL,
  entity_value TEXT NOT NULL,
  normalized_value TEXT,
  confidence NUMERIC(5,2) DEFAULT 100,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_extracted_source ON extracted_entity(source_entity_type, source_entity_id);
CREATE INDEX IF NOT EXISTS idx_extracted_type_value ON extracted_entity(entity_type, normalized_value);

CREATE TABLE IF NOT EXISTS entity_relationship (
  relationship_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_entity_id UUID NOT NULL REFERENCES extracted_entity(extracted_id),
  to_entity_id UUID NOT NULL REFERENCES extracted_entity(extracted_id),
  relationship_type TEXT NOT NULL,
  strength NUMERIC(5,2) DEFAULT 50,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_relationship_from ON entity_relationship(from_entity_id);
CREATE INDEX IF NOT EXISTS idx_relationship_to ON entity_relationship(to_entity_id);
