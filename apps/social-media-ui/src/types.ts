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
  token: string;
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
  threat_score: number;
  metadata_jsonb: Record<string, unknown>;
  published_at: string;
  ingested_at: string;
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
  case_number: string;
  title: string;
  description: string;
  source_alert_id: string | null;
  priority: string;
  state_id: string;
  assigned_to: string | null;
  created_by: string;
  row_version: number;
  created_at: string;
  updated_at: string;
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

export const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3004";
