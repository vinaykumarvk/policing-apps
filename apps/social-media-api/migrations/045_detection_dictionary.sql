-- 045: Detection dictionary enhancements
-- Adds term_type to slang_dictionary, is_active and updated_at to emoji_drug_code

-- 1. Add term_type column to slang_dictionary for unified detection dictionary
ALTER TABLE slang_dictionary ADD COLUMN IF NOT EXISTS term_type VARCHAR(20) DEFAULT 'SLANG';

-- 2. Index on term_type for efficient filtering
CREATE INDEX IF NOT EXISTS idx_slang_term_type ON slang_dictionary (term_type) WHERE is_active = TRUE;

-- 3. Add is_active and updated_at to emoji_drug_code
ALTER TABLE emoji_drug_code ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE emoji_drug_code ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 4. Index on is_active for emoji_drug_code
CREATE INDEX IF NOT EXISTS idx_emoji_drug_code_active ON emoji_drug_code (is_active) WHERE is_active = TRUE;
