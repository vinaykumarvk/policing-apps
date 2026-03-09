/** Shared types for the Social Media UI */

export type UserAccount = {
  user_id: string;
  username: string;
  full_name: string;
  user_type: string;
  email: string;
  phone: string;
  is_active: boolean;
  roles?: string[];
};

export type AuthState = {
  user: UserAccount;
};

export type ContentItem = {
  content_id: string;
  connector_id: string;
  platform: string;
  platform_post_id: string;
  author_handle: string;
  author_name: string;
  content_text: string;
  content_url: string;
  language: string;
  sentiment: string | null;
  category_id: string | null;
  category_name: string | null;
  threat_score: number;
  metadata_jsonb: Record<string, unknown>;
  published_at: string;
  ingested_at: string;
  classification_category: string | null;
  classification_risk_score: number | null;
  classified_by_llm: boolean | null;
  llm_confidence: number | null;
  review_status: string | null;
  effective_category: string | null;
  risk_factors: Array<{ factor: string; weight: number; score: number; detail: string }> | null;
  pipeline_metadata: {
    normalizedText?: string;
    keywordsFound?: string[];
    slangMatches?: Array<{ term: string; normalizedForm: string; category: string; riskWeight: number }>;
    emojiMatches?: Array<{ emoji: string; drugCategory: string; signalType: string; riskWeight: number }>;
    transactionSignals?: Array<{ signalType: string; matched: string }>;
    normalizationsApplied?: string[];
    substanceCategory?: string | null;
    activityType?: string;
    narcoticsScore?: number;
    slangDictionaryVersion?: string;
    processingTimeMs?: number;
    llmUsed?: boolean;
    classifiedAt?: string;
    llmClassification?: {
      narcoticsRelevance?: { label: string; score: number; reasoning: string };
      primaryCategory?: { label: string; score: number; reasoning: string };
      secondaryCategories?: Array<{ label: string; score: number; reasoning: string }>;
      subReasonScores?: Array<{
        reason_code: string;
        reason_label: string;
        score: number;
        matched_evidence: string[];
        explanation: string;
      }>;
      matchedEntities?: {
        drug_terms?: string[];
        slang_terms?: string[];
        emoji_codes?: string[];
        contact_handles?: string[];
        phone_numbers?: string[];
        payment_indicators?: string[];
        locations?: string[];
        delivery_terms?: string[];
      };
      confidenceBand?: string;
      reviewRecommended?: boolean;
      reviewReason?: string;
      finalReasoning?: string;
    };
  } | null;
};

export type SMAlert = {
  alert_id: string;
  alert_type: string;
  priority: string;
  title: string;
  description: string;
  content_id: string | null;
  category_id: string | null;
  state_id: string;
  assigned_to: string | null;
  row_version: number;
  created_at: string;
  updated_at: string;
};

export type EvidenceItem = {
  evidence_id: string;
  content_id: string | null;
  alert_id: string | null;
  case_id: string | null;
  capture_type: string;
  screenshot_url: string | null;
  archive_url: string | null;
  hash_sha256: string | null;
  chain_of_custody: string | null;
  state_id: string;
  captured_by: string;
  row_version: number;
  created_at: string;
  updated_at: string;
};

export type CaseRecord = {
  case_id: string;
  case_ref: string | null;
  case_number: string;
  title: string;
  description: string;
  source_alert_id: string | null;
  priority: string;
  state_id: string;
  assigned_to: string | null;
  assigned_to_name: string | null;
  assigned_to_designation: string | null;
  created_by: string;
  created_by_name: string | null;
  row_version: number;
  due_at: string | null;
  closure_reason: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  category_name: string | null;
  source_alert_ref: string | null;
  source_alert_title: string | null;
  source_alert_priority: string | null;
  source_alert_state: string | null;
  source_content_id: string | null;
};

export type LinkedPost = {
  content_id: string;
  platform: string;
  author_handle: string;
  author_name: string | null;
  content_text: string;
  content_url: string | null;
  language: string;
  threat_score: string | null;
  published_at: string;
  sentiment: string | null;
  classification_category: string | null;
  classification_score: string | null;
};

export type TimelineEvent = {
  event_type: string;
  event_id: string;
  from_state: string | null;
  to_state: string | null;
  transition_id: string | null;
  detail: string | null;
  actor_id: string | null;
  actor_name: string | null;
  created_at: string;
};

export type ReportInstance = {
  report_id: string;
  case_id: string;
  template_id: string | null;
  title: string;
  content_jsonb: Record<string, unknown>;
  state_id: string;
  created_by: string;
  approved_by: string | null;
  exported_at: string | null;
  row_version: number;
  created_at: string;
  updated_at: string;
};

export type Watchlist = {
  watchlist_id: string;
  name: string;
  description: string;
  keywords: string[];
  platforms: string[];
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type Task = {
  task_id: string;
  entity_type: string;
  entity_id: string;
  state_id: string;
  role_id: string;
  status: string;
  decision: string | null;
  remarks: string | null;
  assignee_user_id: string | null;
  sla_due_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SlangEntry = {
  slang_id: string;
  term: string;
  normalized_form: string;
  language: string;
  category: string;
  risk_weight: number;
  is_active: boolean;
  submission_status: string;
  submitted_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  term_type: string;
};

export type EmojiDrugCode = {
  emoji_id: string;
  emoji: string;
  drug_category: string;
  risk_weight: number;
  signal_type: string;
  description: string;
  is_active: boolean;
  created_at: string;
};

export type MonitoringProfile = {
  profile_id: string;
  platform: string;
  entry_type: string;
  handle: string | null;
  url: string | null;
  is_active: boolean;
  priority: string;
  source: string;
  source_ref: string | null;
  suspect_name: string | null;
  notes: string | null;
  last_scraped_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type JurisdictionLocation = {
  location_id: string;
  district_name: string;
  city_names: string[];
  area_names: string[];
  alt_spellings: string[];
  is_active: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type EvidenceLegalHold = {
  hold_id: string;
  evidence_id: string;
  hold_reason: string;
  legal_reference: string;
  held_by: string;
  released_by: string | null;
  held_at: string;
  released_at: string | null;
  is_active: boolean;
};

export type SlaRule = {
  rule_id: string;
  priority: string;
  category: string;
  entity_type: string;
  sla_minutes: number;
  escalate_to_parent: boolean;
};

export type AccessJustification = {
  justification_id: string;
  user_id: string;
  entity_type: string;
  entity_id: string;
  case_id: string | null;
  justification_type: string;
  reason_text: string;
  accessed_at: string;
};

export type DetectionTrend = {
  trend_id: string;
  term_type: string;
  term_value: string;
  category: string | null;
  time_bucket: string;
  occurrence_count: number;
  unit_id: string | null;
};

export type TrendSpikeAlert = {
  spike_id: string;
  term_type: string;
  term_value: string;
  baseline_count: number;
  spike_count: number;
  spike_ratio: number;
  time_window: string | null;
  acknowledged: boolean;
  created_at: string;
};

export type NpsCandidate = {
  nps_id: string;
  term: string;
  context_snippet: string | null;
  source_content_ids: string[];
  occurrence_count: number;
  status: string;
  reviewed_by: string | null;
  created_at: string;
};

export type PlatformPreservationRequest = {
  request_id: string;
  request_ref: string;
  platform: string;
  case_id: string | null;
  alert_id: string | null;
  request_type: string;
  status: string;
  target_accounts: unknown;
  target_content: unknown;
  legal_authority: string;
  valid_from: string;
  valid_until: string;
  generated_document_url: string | null;
  created_by_name: string;
  created_at: string;
};

export type PlatformResponse = {
  response_id: string;
  request_id: string;
  response_type: string;
  response_date: string;
  response_ref: string | null;
  details: string | null;
};

export type LlmProviderConfig = {
  config_id: string;
  provider: string;
  display_name: string;
  api_base_url: string;
  api_key_enc: string;
  model_id: string;
  is_active: boolean;
  is_default: boolean;
  max_tokens: number;
  temperature: number;
  timeout_ms: number;
  max_retries: number;
  config_jsonb: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type LlmSystemPrompt = {
  prompt_id: string;
  use_case: string;
  version: number;
  prompt_text: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type LlmPredictionLog = {
  log_id: string;
  provider: string;
  model_name: string;
  prompt_tokens: number | null;
  output_tokens: number | null;
  use_case: string | null;
  entity_type: string | null;
  entity_id: string | null;
  latency_ms: number;
  fallback_used: boolean;
  created_at: string;
};

export type LegalMappingRule = {
  rule_id: string;
  rule_code: string;
  law_name: string;
  provision_code: string;
  rule_expression: {
    operator: "AND" | "OR";
    conditions: Array<{
      field: string;
      op: string;
      value?: number | string;
      values?: string[];
    }>;
  };
  severity_weight: number;
  version_no: number;
  approval_status: string;
  effective_from: string | null;
  effective_to: string | null;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type LegalMappingResult = {
  mapping_id: string;
  entity_type: string;
  entity_id: string;
  statute_id: string;
  mapping_source: string;
  confidence: number;
  rule_id: string | null;
  provision_code: string | null;
  rationale_text: string | null;
  confidence_score: number | null;
  reviewer_status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  act_name: string;
  section: string;
  description: string;
  penalty_summary: string;
  rule_code: string | null;
  rule_law_name: string | null;
};

export type SourceConnector = {
  connector_id: string;
  platform: string;
  connector_type: string;
  config_jsonb: Record<string, unknown>;
  is_active: boolean;
  default_legal_basis: string | null;
  default_retention_days: number;
  health_status: string;
  error_count: number;
  last_error: string | null;
  last_poll_at: string | null;
  backoff_until: string | null;
  created_at: string;
  updated_at: string;
};

export type ConnectorHealth = {
  connector_id: string;
  platform: string;
  is_active: boolean;
  health_status: string;
  error_count: number;
  last_error: string | null;
  last_poll_at: string | null;
  backoff_until: string | null;
};

export type DeadLetterItem = {
  id: string;
  connector_id: string;
  platform: string;
  error_message: string;
  payload: Record<string, unknown>;
  retry_count: number;
  created_at: string;
};

export type RetentionFlaggedItem = {
  content_id: string;
  platform: string;
  author_handle: string;
  content_url: string | null;
  legal_basis: string | null;
  retention_until: string;
  retention_flagged: boolean;
  ingested_at: string;
};

export const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3004";
