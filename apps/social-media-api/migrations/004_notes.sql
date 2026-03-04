CREATE TABLE IF NOT EXISTS entity_note (
  note_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type VARCHAR(64) NOT NULL,
  entity_id UUID NOT NULL,
  note_text TEXT NOT NULL,
  created_by UUID REFERENCES user_account(user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_entity_note_entity ON entity_note(entity_type, entity_id);
