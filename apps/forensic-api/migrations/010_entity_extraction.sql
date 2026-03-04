-- Entity Extraction & Link Analysis tables for Forensic app
-- The forensic_case 001_init.sql already created extracted_entity and relationship tables
-- with a different schema. We add the missing columns and create parallel indexes
-- for the NER/link-analysis feature.

-- Add columns that the NER service requires but the original schema lacks
ALTER TABLE extracted_entity ADD COLUMN IF NOT EXISTS source_entity_type TEXT;
ALTER TABLE extracted_entity ADD COLUMN IF NOT EXISTS source_entity_id UUID;
ALTER TABLE extracted_entity ADD COLUMN IF NOT EXISTS normalized_value TEXT;

-- The original table uses entity_id as PK; the NER service references extracted_id.
-- Add extracted_id as an alias column that defaults to entity_id for new rows.
-- Since we cannot rename a PK, we add a generated column or handle in code.
-- Actually, the forensic table uses entity_id as PK. We'll adapt the service code
-- to use entity_id instead. Just add the indexes for NER lookups.
CREATE INDEX IF NOT EXISTS idx_extracted_source ON extracted_entity(source_entity_type, source_entity_id);
CREATE INDEX IF NOT EXISTS idx_extracted_type_value ON extracted_entity(entity_type, normalized_value);

-- The original relationship table uses source_entity_id/target_entity_id and weight.
-- We need entity_relationship as a separate table for the NER link-analysis feature,
-- since the existing relationship table has case_id FK and different semantics.
CREATE TABLE IF NOT EXISTS entity_relationship (
  relationship_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_entity_id UUID NOT NULL REFERENCES extracted_entity(entity_id),
  to_entity_id UUID NOT NULL REFERENCES extracted_entity(entity_id),
  relationship_type TEXT NOT NULL,
  strength NUMERIC(5,2) DEFAULT 50,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ner_relationship_from ON entity_relationship(from_entity_id);
CREATE INDEX IF NOT EXISTS idx_ner_relationship_to ON entity_relationship(to_entity_id);
