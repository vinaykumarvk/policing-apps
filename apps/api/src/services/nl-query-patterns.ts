/**
 * PUDA-specific NL query patterns (regex fallback) and DB schema context.
 */

import type { NlQueryPattern } from "@puda/api-core";

export const pudaQueryPatterns: NlQueryPattern[] = [
  {
    pattern: /how many (?:applications?|submissions?) (?:are )?(?:in )?(pending|approved|rejected|draft)/i,
    sqlTemplate: `SELECT COUNT(*)::int AS count FROM application WHERE LOWER(state_id) = LOWER('$1') LIMIT 1`,
    description: "Count of applications by status",
  },
  {
    pattern: /(?:show|list|get) (?:my |all )?(?:pending )?tasks/i,
    sqlTemplate: `SELECT task_id, title, status, assigned_to, sla_due_at FROM task WHERE status IN ('PENDING','IN_PROGRESS') ORDER BY sla_due_at ASC NULLS LAST LIMIT 50`,
    description: "List pending tasks",
  },
  {
    pattern: /(?:show|list|get) (?:recent|latest) applications/i,
    sqlTemplate: `SELECT arn, service_key, state_id, created_at FROM application ORDER BY created_at DESC LIMIT 20`,
    description: "Recent applications",
  },
  {
    pattern: /sla (?:breaches?|overdue|violations?)/i,
    sqlTemplate: `SELECT task_id, title, status, sla_due_at, assigned_to FROM task WHERE status IN ('PENDING','IN_PROGRESS') AND sla_due_at < now() ORDER BY sla_due_at ASC LIMIT 50`,
    description: "SLA breaches / overdue tasks",
  },
  {
    pattern: /(?:application|arn)\s+([A-Z]{2,}-\d{4}-\d+)/i,
    sqlTemplate: `SELECT a.arn, a.service_key, a.state_id, a.created_at, a.applicant_name FROM application a WHERE a.arn = '$1' LIMIT 1`,
    description: "Application lookup by ARN",
  },
];

export const pudaDbSchemaContext = `
TABLES:
- application (arn VARCHAR PK, service_key, state_id, applicant_name, applicant_user_id, created_at, updated_at, metadata_jsonb)
- task (task_id UUID PK, application_arn, title, description, status [PENDING|IN_PROGRESS|COMPLETED|CANCELLED], assigned_to, assigned_role, sla_due_at, created_at, completed_at)
- document (document_id UUID PK, application_arn, document_type, file_name, file_path, uploaded_by, uploaded_at)
- audit_log (audit_id UUID PK, user_id, action, entity_type, entity_id, details_jsonb, created_at)
- service (service_key VARCHAR PK, name, category, description, is_active)
- role (role_id UUID PK, role_key, role_label, description, is_active)
- app_user (user_id UUID PK, login, display_name, email, phone, user_type [CITIZEN|OFFICER|ADMIN], is_active)
- inspection (inspection_id UUID PK, application_arn, inspector_user_id, scheduled_date, status, findings_jsonb)
- fee (fee_id UUID PK, application_arn, fee_type, amount, currency, status, paid_at)
- complaint (complaint_id UUID PK, subject, description, complainant_user_id, status, created_at)
- notification (notification_id UUID PK, user_id, title, body, channel, status, created_at)

RELATIONSHIPS:
- task.application_arn → application.arn
- document.application_arn → application.arn
- inspection.application_arn → application.arn
- fee.application_arn → application.arn
`.trim();
