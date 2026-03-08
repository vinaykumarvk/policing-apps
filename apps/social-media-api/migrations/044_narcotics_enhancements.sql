-- 044: Enhanced narcotics detection pipeline
-- Adds romanized_form to slang_dictionary, emoji drug code reference table

-- 1. Add romanized_form column to slang_dictionary
ALTER TABLE slang_dictionary ADD COLUMN IF NOT EXISTS romanized_form TEXT;

-- 2. Enable pg_trgm extension for trigram fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 3. GIN trigram index on romanized_form for fuzzy matching
CREATE INDEX IF NOT EXISTS idx_slang_romanized_trgm
  ON slang_dictionary USING GIN (romanized_form gin_trgm_ops)
  WHERE romanized_form IS NOT NULL;

-- 4. Emoji drug code reference table
CREATE TABLE IF NOT EXISTS emoji_drug_code (
  emoji_code_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emoji TEXT NOT NULL,
  drug_category TEXT NOT NULL,
  risk_weight NUMERIC(3,2) NOT NULL DEFAULT 1.0,
  signal_type TEXT NOT NULL DEFAULT 'SUBSTANCE',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_emoji_drug_code_emoji
  ON emoji_drug_code (emoji);

-- 5. Insert romanized variants for existing Hindi/Punjabi slang terms
-- Hindi-Latin romanized forms
UPDATE slang_dictionary SET romanized_form = 'maal'    WHERE term = 'maal'    AND language = 'hi' AND romanized_form IS NULL;
UPDATE slang_dictionary SET romanized_form = 'ganja'   WHERE term = 'ganja'   AND language = 'hi' AND romanized_form IS NULL;
UPDATE slang_dictionary SET romanized_form = 'charas'  WHERE term = 'charas'  AND language = 'hi' AND romanized_form IS NULL;
UPDATE slang_dictionary SET romanized_form = 'afeem'   WHERE term = 'afeem'   AND language = 'hi' AND romanized_form IS NULL;
UPDATE slang_dictionary SET romanized_form = 'nashe'   WHERE term = 'nashe'   AND language = 'hi' AND romanized_form IS NULL;
UPDATE slang_dictionary SET romanized_form = 'supari'  WHERE term = 'supari'  AND language = 'hi' AND romanized_form IS NULL;

-- Punjabi-Latin romanized forms
UPDATE slang_dictionary SET romanized_form = 'chitta'  WHERE term = 'chitta'  AND language = 'pa' AND romanized_form IS NULL;
UPDATE slang_dictionary SET romanized_form = 'phukki'  WHERE term = 'phukki'  AND language = 'pa' AND romanized_form IS NULL;
UPDATE slang_dictionary SET romanized_form = 'sulfa'   WHERE term = 'sulfa'   AND language = 'pa' AND romanized_form IS NULL;

-- Also set romanized_form for entries where term is already in Latin script
UPDATE slang_dictionary SET romanized_form = term
  WHERE romanized_form IS NULL
    AND term ~ '^[a-zA-Z0-9 \-]+$'
    AND is_active = TRUE;

-- 6. Seed emoji drug codes (DEA published guide mappings)
INSERT INTO emoji_drug_code (emoji, drug_category, risk_weight, signal_type, description) VALUES
  -- Cocaine
  ('❄️', 'COCAINE', 2.0, 'SUBSTANCE', 'Snowflake — cocaine'),
  ('⛷️', 'COCAINE', 1.5, 'SUBSTANCE', 'Skier — cocaine use'),
  ('🎿', 'COCAINE', 1.5, 'SUBSTANCE', 'Ski — cocaine'),
  ('🔑', 'COCAINE', 1.0, 'SUBSTANCE', 'Key — kilo of cocaine'),
  -- Methamphetamine
  ('💎', 'METH', 2.0, 'SUBSTANCE', 'Diamond — crystal meth'),
  ('🧊', 'METH', 2.0, 'SUBSTANCE', 'Ice cube — crystal meth/ice'),
  ('💙', 'METH', 1.0, 'SUBSTANCE', 'Blue heart — blue meth'),
  -- Pills / MDMA
  ('💊', 'PILLS', 2.0, 'SUBSTANCE', 'Pill — prescription drugs/MDMA/fentanyl pills'),
  ('🍬', 'PILLS', 1.0, 'SUBSTANCE', 'Candy — MDMA/ecstasy'),
  ('🎉', 'PILLS', 0.5, 'SUBSTANCE', 'Party — MDMA/party drugs'),
  -- Cannabis
  ('🍁', 'CANNABIS', 1.5, 'SUBSTANCE', 'Maple leaf — marijuana'),
  ('🌿', 'CANNABIS', 1.5, 'SUBSTANCE', 'Herb — marijuana'),
  ('🍃', 'CANNABIS', 1.5, 'SUBSTANCE', 'Leaf — marijuana'),
  ('🌲', 'CANNABIS', 1.0, 'SUBSTANCE', 'Tree — marijuana'),
  ('⛽', 'CANNABIS', 1.5, 'QUALITY', 'Gas pump — high-grade weed'),
  -- Heroin
  ('🐉', 'HEROIN', 2.0, 'SUBSTANCE', 'Dragon — chasing the dragon/heroin'),
  ('🍫', 'HEROIN', 1.5, 'SUBSTANCE', 'Chocolate — heroin (brown)'),
  ('🥄', 'HEROIN', 1.5, 'SUBSTANCE', 'Spoon — heroin preparation'),
  -- Fentanyl
  ('💀', 'FENTANYL', 2.5, 'SUBSTANCE', 'Skull — fentanyl/deadly potency'),
  ('☠️', 'FENTANYL', 2.5, 'SUBSTANCE', 'Skull and crossbones — fentanyl'),
  -- Lean/Codeine
  ('💜', 'LEAN', 1.5, 'SUBSTANCE', 'Purple heart — lean/purple drank'),
  ('🍇', 'LEAN', 1.0, 'SUBSTANCE', 'Grapes — lean/purple drank'),
  ('🥤', 'LEAN', 1.0, 'SUBSTANCE', 'Cup — lean/styrofoam cup'),
  -- Psychedelics
  ('🍄', 'PSYCHEDELICS', 1.5, 'SUBSTANCE', 'Mushroom — psilocybin mushrooms'),
  ('👁️', 'PSYCHEDELICS', 1.0, 'SUBSTANCE', 'Eye — LSD/psychedelic experience'),
  -- Transaction signals
  ('🔌', 'TRANSACTION', 2.0, 'TRANSACTION', 'Plug — drug dealer/connection'),
  ('📦', 'TRANSACTION', 1.5, 'TRANSACTION', 'Package — drug shipment'),
  ('💸', 'TRANSACTION', 1.5, 'TRANSACTION', 'Money with wings — payment'),
  ('🤑', 'TRANSACTION', 1.5, 'TRANSACTION', 'Money face — for sale'),
  ('📬', 'TRANSACTION', 1.5, 'TRANSACTION', 'Mailbox — mail-order drugs'),
  ('🏧', 'TRANSACTION', 1.0, 'TRANSACTION', 'ATM — cash transaction'),
  -- Quality/potency signals
  ('🔥', 'QUALITY', 1.5, 'QUALITY', 'Fire — potent/high quality'),
  ('💣', 'QUALITY', 1.5, 'QUALITY', 'Bomb — very potent'),
  ('🚀', 'QUALITY', 1.0, 'QUALITY', 'Rocket — strong effect'),
  ('💯', 'QUALITY', 1.0, 'QUALITY', 'Hundred — pure/uncut'),
  ('⭐', 'QUALITY', 0.5, 'QUALITY', 'Star — top quality')
ON CONFLICT (emoji) DO NOTHING;
