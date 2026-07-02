/** Shared types for the officer portal */

export type Task = {
  task_id: string;
  arn: string;
  state_id: string;
  system_role_id: string;
  status: string;
  sla_due_at?: string;
  created_at: string;
  service_key?: string;
  applicant_name?: string;
  authority_id?: string;
};

export type AppDocument = {
  doc_id: string;
  file_name: string;
  file_url?: string;
  mime_type?: string;
  verification_status?: string;
  verified_by?: string;
  verified_at?: string;
};

export type Inspection = {
  inspection_id: string;
  status: string;
  officer_user_id?: string;
  scheduled_at?: string;
  completed_at?: string;
  remarks?: string;
  findings?: string;
};

export type Application = {
  arn: string;
  service_key: string;
  state_id: string;
  data_jsonb: Record<string, unknown>;
  sla_due_at?: string;
  created_at?: string;
  documents: AppDocument[];
  queries: Array<Record<string, unknown>>;
  tasks: Array<Record<string, unknown>>;
  timeline: Array<Record<string, unknown>>;
  disposal_type?: string;
};

export type OfficerUser = {
  user_id: string;
  login: string;
  name: string;
  user_type: string;
};

export type OfficerPosting = {
  posting_id: string;
  authority_id: string;
  designation_name: string;
  system_role_ids: string[];
};

export type OfficerAuth = {
  user: OfficerUser;
};

export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";
