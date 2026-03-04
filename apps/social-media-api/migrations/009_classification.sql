-- AI/ML Classification & Risk Scoring

CREATE TABLE IF NOT EXISTS classification_result (
  classification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  category TEXT,
  risk_score NUMERIC(5,2) DEFAULT 0,
  risk_factors JSONB DEFAULT '[]'::jsonb,
  classified_by TEXT DEFAULT 'SYSTEM',
  analyst_override BOOLEAN DEFAULT false,
  override_by UUID,
  override_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_classification_entity_unique ON classification_result(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_classification_entity ON classification_result(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_classification_risk ON classification_result(risk_score DESC);
