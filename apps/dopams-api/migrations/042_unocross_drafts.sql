-- FR-07 AC-03/04/05: Unocross Draft Generation, Approval, and PDF Export
CREATE TABLE IF NOT EXISTS unocross_draft (
  draft_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID,
  linked_subjects JSONB DEFAULT '[]'::jsonb,
  content_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  state_id VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
    CHECK (state_id IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED')),
  created_by UUID NOT NULL,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_unocross_draft_state ON unocross_draft (state_id);
CREATE INDEX idx_unocross_draft_created_by ON unocross_draft (created_by);
