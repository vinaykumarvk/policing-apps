import { query } from "../db";

/**
 * FR-17: Legal hold, archive workflow, purge approval
 */

export async function setLegalHold(
  caseId: string,
  userId: string,
  reason: string,
): Promise<{ success: boolean }> {
  const result = await query(
    `UPDATE forensic_case
     SET legal_hold_status = 'ACTIVE',
         legal_hold_by = $2,
         legal_hold_at = NOW(),
         legal_hold_reason = $3,
         updated_at = NOW()
     WHERE case_id = $1 AND legal_hold_status != 'ACTIVE'
     RETURNING case_id`,
    [caseId, userId, reason],
  );
  return { success: (result.rowCount ?? 0) > 0 };
}

export async function releaseLegalHold(
  caseId: string,
  userId: string,
): Promise<{ success: boolean }> {
  const result = await query(
    `UPDATE forensic_case
     SET legal_hold_status = 'RELEASED',
         updated_at = NOW()
     WHERE case_id = $1 AND legal_hold_status = 'ACTIVE' AND legal_hold_by = $2
     RETURNING case_id`,
    [caseId, userId],
  );
  return { success: (result.rowCount ?? 0) > 0 };
}

export async function archiveCase(
  caseId: string,
): Promise<{ success: boolean }> {
  const result = await query(
    `UPDATE forensic_case
     SET archived_at = NOW(),
         state_id = 'ARCHIVED',
         updated_at = NOW()
     WHERE case_id = $1
       AND state_id = 'CLOSED'
       AND legal_hold_status != 'ACTIVE'
       AND archived_at IS NULL
     RETURNING case_id`,
    [caseId],
  );
  return { success: (result.rowCount ?? 0) > 0 };
}

export async function requestPurge(
  caseId: string,
  userId: string,
): Promise<{ success: boolean }> {
  const result = await query(
    `UPDATE forensic_case
     SET purge_requested_by = $2,
         purge_requested_at = NOW(),
         updated_at = NOW()
     WHERE case_id = $1
       AND state_id = 'ARCHIVED'
       AND legal_hold_status != 'ACTIVE'
       AND purge_requested_by IS NULL
     RETURNING case_id`,
    [caseId, userId],
  );
  return { success: (result.rowCount ?? 0) > 0 };
}

export async function approvePurge(
  caseId: string,
  approverId: string,
): Promise<{ success: boolean }> {
  // Approver must differ from requester
  const caseRow = await query(
    `SELECT purge_requested_by FROM forensic_case WHERE case_id = $1`,
    [caseId],
  );
  if (caseRow.rows.length === 0) return { success: false };
  if (caseRow.rows[0].purge_requested_by === approverId) return { success: false };

  const result = await query(
    `UPDATE forensic_case
     SET purge_approved_by = $2,
         purge_approved_at = NOW(),
         updated_at = NOW()
     WHERE case_id = $1
       AND purge_requested_by IS NOT NULL
       AND purge_approved_by IS NULL
     RETURNING case_id`,
    [caseId, approverId],
  );
  return { success: (result.rowCount ?? 0) > 0 };
}
