CREATE TABLE IF NOT EXISTS model_registry (
  model_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name TEXT NOT NULL,
  model_type TEXT NOT NULL, -- CLASSIFIER, NER, RISK_SCORER, OCR, TRANSLATOR
  version TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','TESTING','ACTIVE','DEPRECATED','RETIRED')),
  config JSONB DEFAULT '{}'::jsonb,
  performance_metrics JSONB DEFAULT '{}'::jsonb, -- accuracy, precision, recall, f1
  training_data_summary JSONB DEFAULT '{}'::jsonb,
  created_by UUID,
  activated_at TIMESTAMPTZ,
  retired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(model_name, version)
);
CREATE INDEX IF NOT EXISTS idx_model_registry_name ON model_registry(model_name);
CREATE INDEX IF NOT EXISTS idx_model_registry_status ON model_registry(status);
CREATE INDEX IF NOT EXISTS idx_model_registry_type ON model_registry(model_type);

CREATE TABLE IF NOT EXISTS model_evaluation (
  evaluation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES model_registry(model_id),
  evaluation_type TEXT NOT NULL DEFAULT 'MANUAL' CHECK (evaluation_type IN ('MANUAL','AUTOMATED','AB_TEST')),
  dataset_name TEXT,
  dataset_size INTEGER,
  metrics JSONB DEFAULT '{}'::jsonb, -- accuracy, precision, recall, f1, etc.
  notes TEXT,
  evaluated_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_model_evaluation_model ON model_evaluation(model_id);

CREATE TABLE IF NOT EXISTS model_prediction_log (
  log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES model_registry(model_id),
  input_hash TEXT,
  prediction JSONB,
  actual_label TEXT,
  is_correct BOOLEAN,
  latency_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_prediction_log_model ON model_prediction_log(model_id);
CREATE INDEX IF NOT EXISTS idx_prediction_log_time ON model_prediction_log(created_at DESC);
