-- FR-20: Taxonomy table, threshold enforcement
-- FR-03: OCR confidence thresholds, versioned assertions

CREATE TABLE IF NOT EXISTS taxonomy_category (
  category_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_name TEXT NOT NULL,
  parent_id UUID REFERENCES taxonomy_category(category_id),
  level INTEGER DEFAULT 0,
  path TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS classification_threshold (
  threshold_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES taxonomy_category(category_id),
  min_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  max_score NUMERIC(5,2) NOT NULL DEFAULT 100,
  action TEXT NOT NULL CHECK (action IN ('AUTO_ACCEPT', 'NEEDS_REVIEW', 'AUTO_REJECT')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- OCR confidence and versioned assertions
ALTER TABLE ocr_job ADD COLUMN IF NOT EXISTS confidence_threshold NUMERIC(5,2) DEFAULT 80;
ALTER TABLE ocr_job ADD COLUMN IF NOT EXISTS assertion_version INTEGER DEFAULT 1;
ALTER TABLE ocr_job ADD COLUMN IF NOT EXISTS review_status TEXT DEFAULT 'PENDING'
  CHECK (review_status IN ('PENDING', 'AUTO_ACCEPTED', 'NEEDS_REVIEW', 'REVIEWED', 'REJECTED'));

CREATE INDEX IF NOT EXISTS idx_taxonomy_parent ON taxonomy_category (parent_id);
CREATE INDEX IF NOT EXISTS idx_taxonomy_path ON taxonomy_category (path);
CREATE INDEX IF NOT EXISTS idx_classification_threshold ON classification_threshold (category_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_ocr_review ON ocr_job (review_status) WHERE review_status = 'NEEDS_REVIEW';

-- Seed top-level taxonomy
INSERT INTO taxonomy_category (category_name, level, path, description) VALUES
  ('Narcotics', 0, '/narcotics', 'Drug trafficking and substance abuse'),
  ('Financial Crime', 0, '/financial-crime', 'Hawala, benami, shell companies'),
  ('Organized Crime', 0, '/organized-crime', 'Gang activity and syndicate operations'),
  ('Cybercrime', 0, '/cybercrime', 'Online fraud, hacking, digital offenses'),
  ('Terrorism', 0, '/terrorism', 'Terror financing, radicalization'),
  ('Property Crime', 0, '/property-crime', 'Theft, burglary, robbery')
ON CONFLICT DO NOTHING;
