/** Shared types for the Forensic UI */

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

export type ForensicCase = {
  case_id: string;
  case_number: string;
  title: string;
  description: string;
  case_type: string;
  priority: string;
  state_id: string;
  dopams_case_ref: string | null;
  assigned_to: string | null;
  created_by: string;
  row_version: number;
  created_at: string;
  updated_at: string;
};

export type EvidenceSource = {
  evidence_id: string;
  case_id: string;
  source_type: string;
  device_info: string | null;
  file_url: string | null;
  file_name: string | null;
  file_size_bytes: number | null;
  hash_sha256: string | null;
  chain_of_custody: string | null;
  state_id: string;
  uploaded_by: string;
  row_version: number;
  created_at: string;
  updated_at: string;
};

export type ImportJob = {
  import_job_id: string;
  case_id: string;
  evidence_id: string;
  job_type: string;
  state_id: string;
  progress_pct: number;
  error_message: string | null;
  warnings: string[];
  started_at: string | null;
  completed_at: string | null;
  row_version: number;
  created_at: string;
  updated_at: string;
};

export type Artifact = {
  artifact_id: string;
  case_id: string;
  import_job_id: string;
  artifact_type: string;
  source_path: string;
  content_preview: string | null;
  metadata_jsonb: Record<string, unknown>;
  created_at: string;
};

export type AIFinding = {
  finding_id: string;
  case_id: string;
  finding_type: string;
  severity: string;
  title: string;
  description: string;
  evidence_refs: string[];
  confidence: number;
  state_id: string;
  reviewed_by: string | null;
  row_version: number;
  created_at: string;
  updated_at: string;
};

export type Report = {
  report_id: string;
  case_id: string;
  title: string;
  report_type: string;
  template_id: string | null;
  content_jsonb: Record<string, unknown>;
  state_id: string;
  version_number: number;
  supersedes_id: string | null;
  created_by: string;
  approved_by: string | null;
  published_at: string | null;
  row_version: number;
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
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3012";
