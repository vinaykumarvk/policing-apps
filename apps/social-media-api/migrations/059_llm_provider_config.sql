-- LLM Provider Configuration & System Prompts
-- Enables provider-agnostic LLM integration with full audit trail

-- Provider configuration table
CREATE TABLE IF NOT EXISTS llm_provider_config (
  config_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider      VARCHAR(32) NOT NULL CHECK (provider IN ('openai','claude','gemini','ollama')),
  display_name  VARCHAR(128) NOT NULL,
  api_base_url  TEXT NOT NULL,
  api_key_enc   TEXT,
  model_id      VARCHAR(128) NOT NULL,
  is_active     BOOLEAN DEFAULT TRUE,
  is_default    BOOLEAN DEFAULT FALSE,
  max_tokens    INTEGER DEFAULT 2048,
  temperature   NUMERIC(3,2) DEFAULT 0.3,
  timeout_ms    INTEGER DEFAULT 30000,
  max_retries   INTEGER DEFAULT 2,
  config_jsonb  JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Only one default provider at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_llm_provider_single_default
  ON llm_provider_config (is_default) WHERE is_default = TRUE;

CREATE INDEX IF NOT EXISTS idx_llm_provider_active
  ON llm_provider_config (is_active) WHERE is_active = TRUE;

-- System prompts versioned by use case
CREATE TABLE IF NOT EXISTS llm_system_prompt (
  prompt_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  use_case    VARCHAR(64) NOT NULL CHECK (use_case IN (
    'CLASSIFICATION','TRANSLATION','NARCOTICS_ANALYSIS','RISK_NARRATIVE','INVESTIGATION_SUMMARY'
  )),
  version     INTEGER NOT NULL DEFAULT 1,
  prompt_text TEXT NOT NULL,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(use_case, version)
);

CREATE INDEX IF NOT EXISTS idx_llm_prompt_active
  ON llm_system_prompt (use_case, is_active) WHERE is_active = TRUE;

-- Extend model_prediction_log with LLM-specific columns
ALTER TABLE model_prediction_log
  ADD COLUMN IF NOT EXISTS provider      VARCHAR(32),
  ADD COLUMN IF NOT EXISTS model_name    VARCHAR(128),
  ADD COLUMN IF NOT EXISTS prompt_tokens INTEGER,
  ADD COLUMN IF NOT EXISTS output_tokens INTEGER,
  ADD COLUMN IF NOT EXISTS use_case      VARCHAR(64),
  ADD COLUMN IF NOT EXISTS entity_type   VARCHAR(64),
  ADD COLUMN IF NOT EXISTS entity_id     UUID,
  ADD COLUMN IF NOT EXISTS fallback_used BOOLEAN DEFAULT FALSE;

-- Allow model_id to be nullable for LLM predictions (no model_registry entry)
ALTER TABLE model_prediction_log
  ALTER COLUMN model_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_prediction_log_use_case
  ON model_prediction_log (use_case) WHERE use_case IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_prediction_log_provider
  ON model_prediction_log (provider) WHERE provider IS NOT NULL;

-- Extend classification_result with LLM metadata
ALTER TABLE classification_result
  ADD COLUMN IF NOT EXISTS classified_by_llm BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS llm_confidence    NUMERIC(5,4);

-- Extend translation_record with LLM metadata
ALTER TABLE translation_record
  ADD COLUMN IF NOT EXISTS llm_model  VARCHAR(128),
  ADD COLUMN IF NOT EXISTS llm_tokens INTEGER;

-- Seed system prompts
INSERT INTO llm_system_prompt (use_case, version, prompt_text, is_active) VALUES
(
  'CLASSIFICATION', 1,
  'You are a social media content classifier for law enforcement. Analyze the following social media post and classify it into ONE of these categories: HATE_SPEECH, FRAUD, HARASSMENT, CSAM, TERRORISM, DRUGS, ILLICIT_LIQUOR, CYBER_CRIME, or UNCATEGORIZED.

Return a JSON object with:
- "category": the classification category
- "confidence": a number 0-1 indicating your confidence
- "risk_score": a number 0-100 indicating threat severity
- "factors": array of {"factor": string, "detail": string} explaining your reasoning

Consider regional context (India, particularly Telangana/Andhra Pradesh). Look for coded language, slang, and emojis commonly used in drug trade communications.

Respond ONLY with valid JSON, no markdown or explanation.',
  TRUE
),
(
  'TRANSLATION', 1,
  'You are a translator specializing in Indian languages relevant to law enforcement. Translate the following text to English. Preserve the original meaning, including slang, code words, and colloquialisms. If the text contains drug-related slang or coded language, provide both a literal translation and an interpretation.

Return a JSON object with:
- "translated_text": the English translation
- "source_language": detected source language code (hi, te, pa, bn, etc.)
- "notes": any relevant context about slang or coded language detected

Respond ONLY with valid JSON, no markdown or explanation.',
  TRUE
),
(
  'NARCOTICS_ANALYSIS', 1,
  'You are a narcotics intelligence analyst. Analyze the following social media content for drug-related activity indicators. Consider:
1. Direct or coded references to controlled substances
2. Transaction indicators (pricing, quantities, delivery methods)
3. Distribution network signals (contact info, encrypted messaging references)
4. Regional drug slang (Telugu, Hindi, Punjabi variants)
5. Emoji codes commonly used in drug communications

Return a JSON object with:
- "narcotics_score": 0-100 risk score
- "substance_category": detected substance type or null
- "activity_type": DISTRIBUTION/ACTIVE_SALE/PURCHASE/USE/NONE
- "factors": array of {"factor": string, "contribution": number, "detail": string}
- "coded_language": array of detected code words/emojis with interpretations

Respond ONLY with valid JSON, no markdown or explanation.',
  TRUE
),
(
  'RISK_NARRATIVE', 1,
  'You are an intelligence analyst generating risk assessment narratives for law enforcement supervisors. Given the following content classification data (category, risk score, risk factors, and narcotics analysis), generate a concise 2-3 paragraph risk narrative explaining:
1. Why this content was flagged
2. The specific threat indicators identified
3. Recommended priority level and suggested next steps

Write in professional law enforcement language. Be specific about the evidence found. Do not speculate beyond the data provided.',
  TRUE
),
(
  'INVESTIGATION_SUMMARY', 1,
  'You are an intelligence analyst generating investigation summaries. Given the following case/alert data (alerts, content items, actor information, classification results), generate a structured investigation summary with:

1. **Subject Overview**: Who is involved and what platforms
2. **Activity Pattern**: Timeline and pattern of suspicious activity
3. **Risk Assessment**: Current threat level and trajectory
4. **Evidence Summary**: Key pieces of evidence and their significance
5. **Recommended Actions**: Suggested investigative steps

Write in professional law enforcement report format. Be factual and cite specific data points.',
  TRUE
)
ON CONFLICT (use_case, version) DO NOTHING;
