-- Tier 4D: Drug Offender Role Classification

CREATE TABLE IF NOT EXISTS drug_role_classification (
  classification_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_entity_type TEXT NOT NULL,
  subject_entity_id UUID NOT NULL,
  role_type TEXT NOT NULL CHECK (role_type IN ('PEDDLER','COURIER','KINGPIN','MANUFACTURER','FINANCIER','CONSUMER','RECRUITER','UNKNOWN')),
  confidence NUMERIC(5,2) DEFAULT 0,
  factors JSONB DEFAULT '[]'::jsonb,
  is_recidivist BOOLEAN DEFAULT false,
  prior_offenses INTEGER DEFAULT 0,
  review_status TEXT DEFAULT 'PENDING' CHECK (review_status IN ('PENDING','CONFIRMED','REJECTED','UNDER_REVIEW')),
  reviewed_by UUID REFERENCES user_account(user_id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drug_role_entity ON drug_role_classification(subject_entity_type, subject_entity_id);
CREATE INDEX IF NOT EXISTS idx_drug_role_type ON drug_role_classification(role_type);
CREATE INDEX IF NOT EXISTS idx_drug_role_recidivist ON drug_role_classification(is_recidivist) WHERE is_recidivist = true;

CREATE TABLE IF NOT EXISTS drug_role_rule (
  rule_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_type TEXT NOT NULL,
  rule_name TEXT NOT NULL,
  keywords TEXT[] DEFAULT '{}',
  weight NUMERIC(5,2) DEFAULT 1.0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed classification rules
INSERT INTO drug_role_rule (role_type, rule_name, keywords, weight) VALUES
  ('PEDDLER', 'street_sale_indicators', ARRAY['sell', 'sold', 'supply', 'distribute', 'peddl', 'deal', 'retail', 'gram', 'dose'], 1.0),
  ('PEDDLER', 'small_quantity', ARRAY['small quantity', 'personal use', 'few grams', 'packet', 'sachet'], 0.8),
  ('COURIER', 'transport_indicators', ARRAY['transport', 'carry', 'deliver', 'courier', 'mule', 'smuggl', 'conceal', 'border', 'transit'], 1.0),
  ('COURIER', 'vehicle_reference', ARRAY['vehicle', 'car', 'truck', 'bus', 'train', 'flight', 'airport', 'highway'], 0.6),
  ('KINGPIN', 'leadership_indicators', ARRAY['boss', 'leader', 'head', 'kingpin', 'mastermind', 'network', 'cartel', 'syndicate', 'organization'], 1.0),
  ('KINGPIN', 'financial_control', ARRAY['fund', 'financ', 'money', 'profit', 'revenue', 'hawala', 'launder', 'account'], 0.8),
  ('KINGPIN', 'large_operation', ARRAY['large quantity', 'bulk', 'wholesale', 'kilogram', 'tonne', 'commercial quantity', 'inter-state', 'international'], 0.9),
  ('MANUFACTURER', 'production_indicators', ARRAY['manufactur', 'produc', 'lab', 'laboratory', 'synthe', 'process', 'chemical', 'precursor', 'cook'], 1.0),
  ('MANUFACTURER', 'equipment', ARRAY['equipment', 'apparatus', 'reactor', 'distill', 'extract'], 0.7),
  ('FINANCIER', 'money_indicators', ARRAY['financ', 'invest', 'fund', 'bank', 'account', 'hawala', 'money trail', 'transaction', 'proceeds'], 1.0),
  ('CONSUMER', 'consumption_indicators', ARRAY['addict', 'user', 'consum', 'personal use', 'possess', 'inject', 'smoke', 'inhale', 'overdose'], 1.0),
  ('RECRUITER', 'recruitment_indicators', ARRAY['recruit', 'enlist', 'lure', 'groom', 'train', 'induc', 'hire', 'employ'], 1.0)
ON CONFLICT DO NOTHING;
