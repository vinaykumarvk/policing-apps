/**
 * PUDA-specific NL query patterns (regex fallback) and DB schema context.
 */

import type { NlQueryPattern } from "@puda/api-core";

export const pudaQueryPatterns: NlQueryPattern[] = [
  {
    pattern: /how many (?:applications?|submissions?) (?:are )?(?:in )?(pending|approved|rejected|draft|submitted|disposed)/i,
    sqlTemplate: `SELECT COUNT(*)::int AS count FROM application WHERE LOWER(state_id) LIKE '%' || LOWER('$1') || '%' LIMIT 1`,
    description: "Count of applications by status",
  },
  {
    pattern: /(?:show|list|get) (?:my |all )?(?:pending )?tasks/i,
    sqlTemplate: `SELECT task_id, arn, state_id, status, assignee_user_id, sla_due_at FROM task WHERE status IN ('PENDING','IN_PROGRESS') ORDER BY sla_due_at ASC NULLS LAST LIMIT 50`,
    description: "List pending tasks",
  },
  {
    pattern: /(?:show|list|get) (?:recent|latest) applications/i,
    sqlTemplate: `SELECT arn, service_key, state_id, applicant_user_id, created_at FROM application ORDER BY created_at DESC LIMIT 20`,
    description: "Recent applications",
  },
  {
    pattern: /sla (?:breaches?|overdue|violations?)/i,
    sqlTemplate: `SELECT task_id, arn, status, sla_due_at, assignee_user_id FROM task WHERE status IN ('PENDING','IN_PROGRESS') AND sla_due_at < now() ORDER BY sla_due_at ASC LIMIT 50`,
    description: "SLA breaches / overdue tasks",
  },
  {
    pattern: /(?:application|arn)\s+([A-Z]{2,}-\d{4}-\d+)/i,
    sqlTemplate: `SELECT arn, service_key, state_id, applicant_user_id, created_at FROM application WHERE arn = '$1' LIMIT 1`,
    description: "Application lookup by ARN",
  },
];

export const pudaDbSchemaContext = `
TABLES:
- application (arn TEXT PK, service_key TEXT, authority_id TEXT, state_id TEXT, data_jsonb JSONB, applicant_user_id TEXT, created_at TIMESTAMPTZ, submitted_at TIMESTAMPTZ, disposed_at TIMESTAMPTZ, disposal_type TEXT, sla_due_at TIMESTAMPTZ, public_arn TEXT)
- task (task_id TEXT PK, arn TEXT FK→application.arn, state_id TEXT, system_role_id TEXT, assignee_user_id TEXT, status TEXT [PENDING|IN_PROGRESS|COMPLETED|CANCELLED], sla_due_at TIMESTAMPTZ, created_at TIMESTAMPTZ, completed_at TIMESTAMPTZ, decision TEXT, remarks TEXT)
- document (doc_id TEXT PK, arn TEXT FK→application.arn, doc_type_id TEXT, original_filename TEXT, mime_type TEXT, size_bytes INT, storage_key TEXT, uploaded_by_user_id TEXT, created_at TIMESTAMPTZ)
- audit_event (event_id TEXT PK, user_id TEXT, event_type TEXT, entity_type TEXT, entity_id TEXT, details_jsonb JSONB, created_at TIMESTAMPTZ)
- service (service_key TEXT PK, name TEXT, category TEXT, description TEXT, is_active BOOLEAN)
- "user" (user_id TEXT PK, login TEXT, name TEXT, email TEXT, phone TEXT, user_type TEXT [CITIZEN|OFFICER|ADMIN])
- complaint (complaint_id TEXT PK, complaint_number TEXT, user_id TEXT, violation_type TEXT, location_address TEXT, status TEXT, created_at TIMESTAMPTZ)
- notification (notification_id TEXT PK, user_id TEXT, arn TEXT, event_type TEXT, title TEXT, message TEXT, read BOOLEAN, created_at TIMESTAMPTZ)
- fee_demand (fee_demand_id TEXT PK, arn TEXT FK→application.arn, status TEXT, total_amount NUMERIC, created_at TIMESTAMPTZ)
- inspection (inspection_id TEXT PK, arn TEXT FK→application.arn, inspector_user_id TEXT, scheduled_date DATE, status TEXT, findings_jsonb JSONB)

RELATIONSHIPS:
- task.arn → application.arn
- document.arn → application.arn
- inspection.arn → application.arn
- fee_demand.arn → application.arn
- complaint.user_id → "user".user_id
- notification.user_id → "user".user_id

NOTES:
- The "user" table name is quoted because it's a reserved word
- application.data_jsonb contains form fields like applicant_name, plot_number, etc.
- state_id values include: DRAFT, SUBMITTED, PENDING_VERIFICATION, APPROVED, REJECTED, DISPOSED
- task.status values: PENDING, IN_PROGRESS, COMPLETED, CANCELLED
`.trim();
