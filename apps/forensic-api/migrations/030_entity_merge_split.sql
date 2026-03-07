-- FR-08: Entity merge/split with timeline

ALTER TABLE extracted_entity ADD COLUMN IF NOT EXISTS is_merged BOOLEAN DEFAULT FALSE;
ALTER TABLE extracted_entity ADD COLUMN IF NOT EXISTS merged_into_id UUID REFERENCES extracted_entity(entity_id);
ALTER TABLE extracted_entity ADD COLUMN IF NOT EXISTS split_from_id UUID REFERENCES extracted_entity(entity_id);

CREATE TABLE IF NOT EXISTS entity_timeline (
  timeline_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES extracted_entity(entity_id),
  event_type TEXT NOT NULL CHECK (event_type IN ('CREATED', 'MERGED', 'SPLIT', 'UPDATED', 'LINKED', 'UNLINKED')),
  event_data JSONB DEFAULT '{}'::jsonb,
  performed_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entity_merged ON extracted_entity (merged_into_id) WHERE merged_into_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_entity_timeline ON entity_timeline (entity_id, created_at DESC);
