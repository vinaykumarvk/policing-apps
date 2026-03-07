-- FR-03: Parser framework for UFED, XRY, Oxygen, FTK, AXIOM, Belkasoft
-- FR-02: Idempotency-Key, checksum quarantine, duplicate detection
-- FR-06: Derived artifact creation from OCR output

-- Extend import_job for parser integration
ALTER TABLE import_job ADD COLUMN IF NOT EXISTS parser_type TEXT;
ALTER TABLE import_job ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE import_job ADD COLUMN IF NOT EXISTS checksum_sha256 TEXT;
ALTER TABLE import_job ADD COLUMN IF NOT EXISTS quarantine_reason TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_import_job_idempotency ON import_job (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_import_job_checksum ON import_job (checksum_sha256) WHERE checksum_sha256 IS NOT NULL;

-- Extend artifact for derived artifacts
ALTER TABLE artifact ADD COLUMN IF NOT EXISTS is_derived BOOLEAN DEFAULT FALSE;
ALTER TABLE artifact ADD COLUMN IF NOT EXISTS derived_from_id UUID REFERENCES artifact(artifact_id);
ALTER TABLE artifact ADD COLUMN IF NOT EXISTS derivation_method TEXT;
ALTER TABLE artifact ADD COLUMN IF NOT EXISTS hash_sha256 TEXT;

CREATE INDEX IF NOT EXISTS idx_artifact_derived ON artifact (derived_from_id) WHERE derived_from_id IS NOT NULL;

-- Parser configuration table
CREATE TABLE IF NOT EXISTS parser_config (
  parser_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parser_name TEXT NOT NULL UNIQUE,
  parser_type TEXT NOT NULL,
  description TEXT,
  supported_extensions TEXT[] NOT NULL DEFAULT '{}',
  config_jsonb JSONB DEFAULT '{}'::jsonb,
  version TEXT DEFAULT '1.0',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed parsers for the 6 forensic tools
INSERT INTO parser_config (parser_name, parser_type, description, supported_extensions, version) VALUES
  ('Cellebrite UFED', 'UFED', 'Parser for Cellebrite UFED extraction reports', ARRAY['.ufdr', '.xml', '.zip'], '1.0'),
  ('MSAB XRY', 'XRY', 'Parser for MSAB XRY extraction files', ARRAY['.xry', '.xml', '.zip'], '1.0'),
  ('Oxygen Forensic', 'OXYGEN', 'Parser for Oxygen Forensic Detective exports', ARRAY['.ofb', '.xml', '.zip'], '1.0'),
  ('AccessData FTK', 'FTK', 'Parser for AccessData FTK image and report files', ARRAY['.ad1', '.e01', '.zip'], '1.0'),
  ('Magnet AXIOM', 'AXIOM', 'Parser for Magnet AXIOM case exports', ARRAY['.case', '.xml', '.zip'], '1.0'),
  ('Belkasoft Evidence Center', 'BELKASOFT', 'Parser for Belkasoft Evidence Center exports', ARRAY['.bec', '.xml', '.zip'], '1.0')
ON CONFLICT (parser_name) DO NOTHING;
