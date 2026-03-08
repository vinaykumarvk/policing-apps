import { query } from "../db";
import { logInfo, logWarn } from "../logger";
import { getParentUnit } from "./tiered-visibility";

/** Check alerts against SLA rules and auto-escalate breached ones */
export async function checkAndEscalate(): Promise<number> {
  try {
    // Find alerts that breached SLA and haven't been escalated yet
    const breached = await query(
      `SELECT a.alert_id, a.priority, a.unit_id, a.escalation_level,
              sr.sla_minutes, sr.escalate_to_parent
       FROM sm_alert a
       JOIN sla_rule sr ON sr.priority = a.priority AND sr.entity_type = 'sm_alert' AND sr.is_active = TRUE
       WHERE a.state_id NOT IN ('RESOLVED', 'CLOSED')
         AND a.created_at + (sr.sla_minutes || ' minutes')::interval < NOW()
         AND a.pending_approval = FALSE
         AND sr.escalate_to_parent = TRUE
         AND a.escalation_level < 3`,
    );

    let escalated = 0;
    for (const alert of breached.rows) {
      if (!alert.unit_id) continue;
      const parent = await getParentUnit(alert.unit_id);
      if (!parent) continue;

      await query(
        `UPDATE sm_alert SET
           pending_approval = TRUE,
           escalation_reason = 'SLA breach: ' || $2 || ' priority exceeded ' || $3 || ' minutes',
           escalation_level = escalation_level + 1,
           updated_at = NOW()
         WHERE alert_id = $1`,
        [alert.alert_id, alert.priority, alert.sla_minutes],
      );
      escalated++;
    }

    if (escalated > 0) {
      logInfo("AUTO_ESCALATION_COMPLETE", { escalated });
    }
    return escalated;
  } catch (err) {
    logWarn("Auto-escalation check failed", { error: String(err) });
    return 0;
  }
}

/** Request manual escalation for an alert */
export async function requestEscalationApproval(
  alertId: string, userId: string, reason: string,
): Promise<boolean> {
  const result = await query(
    `UPDATE sm_alert SET
       pending_approval = TRUE,
       approval_requested_by = $2,
       approval_requested_at = NOW(),
       escalation_reason = $3,
       updated_at = NOW()
     WHERE alert_id = $1 AND pending_approval = FALSE
     RETURNING alert_id`,
    [alertId, userId, reason],
  );
  return (result.rowCount ?? 0) > 0;
}

/** Approve escalation — moves alert to parent unit */
export async function approveEscalation(
  alertId: string, approverUserId: string,
): Promise<boolean> {
  const alertResult = await query(
    "SELECT alert_id, unit_id FROM sm_alert WHERE alert_id = $1 AND pending_approval = TRUE",
    [alertId],
  );
  if (alertResult.rows.length === 0) return false;

  const alert = alertResult.rows[0];
  const parent = alert.unit_id ? await getParentUnit(alert.unit_id) : null;

  await query(
    `UPDATE sm_alert SET
       pending_approval = FALSE,
       approved_by = $2,
       approved_at = NOW(),
       escalated_from_unit_id = unit_id,
       unit_id = COALESCE($3, unit_id),
       escalation_level = escalation_level + 1,
       state_id = 'ESCALATED',
       updated_at = NOW()
     WHERE alert_id = $1`,
    [alertId, approverUserId, parent?.unit_id || null],
  );
  return true;
}

/** Reject escalation */
export async function rejectEscalation(
  alertId: string, rejectorUserId: string,
): Promise<boolean> {
  const result = await query(
    `UPDATE sm_alert SET
       pending_approval = FALSE,
       approved_by = $2,
       approved_at = NOW(),
       escalation_reason = escalation_reason || ' [REJECTED]',
       updated_at = NOW()
     WHERE alert_id = $1 AND pending_approval = TRUE
     RETURNING alert_id`,
    [alertId, rejectorUserId],
  );
  return (result.rowCount ?? 0) > 0;
}
