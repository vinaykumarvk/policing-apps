/** Shared types for the DOPAMS UI */

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

export type Alert = {
  alert_id: string;
  alert_type: string;
  severity: string;
  title: string;
  description: string;
  source_system: string;
  subject_id: string | null;
  case_id: string | null;
  state_id: string;
  assigned_to: string | null;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
  row_version: number;
  created_at: string;
  updated_at: string;
};

export type Lead = {
  lead_id: string;
  source_type: string;
  summary: string;
  details: string;
  priority: string;
  state_id: string;
  subject_id: string | null;
  assigned_to: string | null;
  created_by: string;
  row_version: number;
  created_at: string;
  updated_at: string;
};

export type DopamsCase = {
  case_id: string;
  case_number: string;
  title: string;
  description: string;
  case_type: string;
  priority: string;
  state_id: string;
  assigned_to: string | null;
  created_by: string;
  row_version: number;
  created_at: string;
  updated_at: string;
};

export type SubjectProfile = {
  subject_id: string;
  full_name: string;
  aliases: string[];
  date_of_birth: string | null;
  gender: string | null;
  identifiers: Record<string, string>;
  addresses: string[];
  photo_url: string | null;
  risk_score: number;
  state_id: string;
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
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3002";
