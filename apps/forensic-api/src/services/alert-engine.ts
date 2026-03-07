import { query } from "../db";

export interface AlertRuleMatch {
  ruleId: string;
  ruleName: string;
  alertType: string;
  severity: string;
  slaHours: number;
  autoAssignRole: string | null;
}

/**
 * Evaluate alert rules against an entity event.
 */
export async function evaluateAlertRules(
  entityType: string,
  eventType: string,
  entityData: Record<string, unknown>,
): Promise<AlertRuleMatch[]> {
  const result = await query(
    `SELECT rule_id, rule_name, alert_type, severity, sla_hours, auto_assign_role, conditions
     FROM alert_rule
     WHERE entity_type = $1 AND event_type = $2 AND is_active = TRUE`,
    [entityType, eventType],
  );

  const matches: AlertRuleMatch[] = [];
  for (const rule of result.rows) {
    if (matchesConditions(rule.conditions, entityData)) {
      matches.push({
        ruleId: rule.rule_id,
        ruleName: rule.rule_name,
        alertType: rule.alert_type,
        severity: rule.severity,
        slaHours: rule.sla_hours,
        autoAssignRole: rule.auto_assign_role,
      });
    }
  }
  return matches;
}

function matchesConditions(conditions: Record<string, unknown>, data: Record<string, unknown>): boolean {
  for (const [key, expected] of Object.entries(conditions)) {
    const actual = data[key];
    if (typeof expected === "object" && expected !== null && !Array.isArray(expected)) {
      const cond = expected as Record<string, unknown>;
      if (cond.gte !== undefined && (typeof actual !== "number" || actual < (cond.gte as number))) return false;
      if (cond.lte !== undefined && (typeof actual !== "number" || actual > (cond.lte as number))) return false;
    } else if (actual !== expected) {
      return false;
    }
  }
  return true;
}

/**
 * Create alerts from matching rules with SLA and auto-assignment.
 */
export async function fireAlerts(
  caseId: string,
  entityType: string,
  eventType: string,
  entityData: Record<string, unknown>,
  title: string,
  description: string,
): Promise<number> {
  const matches = await evaluateAlertRules(entityType, eventType, entityData);
  let created = 0;

  for (const match of matches) {
    let assignedTo: string | null = null;

    // Auto-assign to role member
    if (match.autoAssignRole) {
      const userResult = await query(
        `SELECT u.user_id FROM user_account u
         JOIN user_role ur ON u.user_id = ur.user_id
         JOIN role r ON ur.role_id = r.role_id
         WHERE r.role_key = $1 AND u.is_active = TRUE
         ORDER BY RANDOM() LIMIT 1`,
        [match.autoAssignRole],
      );
      if (userResult.rows.length > 0) {
        assignedTo = userResult.rows[0].user_id;
      }
    }

    await query(
      `INSERT INTO alert (case_id, alert_type, severity, title, description, state_id,
        assigned_to, sla_due_at)
       VALUES ($1, $2, $3, $4, $5, 'NEW', $6,
        CASE WHEN $7::int > 0 THEN NOW() + ($7::int || ' hours')::interval ELSE NULL END)`,
      [caseId, match.alertType, match.severity, title, description,
       assignedTo, match.slaHours],
    );
    created++;
  }

  return created;
}

/**
 * Assign an alert to a user.
 */
export async function assignAlert(alertId: string, assignedTo: string): Promise<void> {
  await query(
    `UPDATE alert SET assigned_to = $1, state_id = CASE WHEN state_id = 'NEW' THEN 'ACKNOWLEDGED' ELSE state_id END
     WHERE alert_id = $2`,
    [assignedTo, alertId],
  );
}

/**
 * Transition alert through lifecycle: NEW→ACKNOWLEDGED→INVESTIGATING→RESOLVED/DISMISSED
 */
export async function transitionAlert(
  alertId: string,
  newState: string,
  userId: string,
  notes?: string,
): Promise<Record<string, unknown> | null> {
  const validTransitions: Record<string, string[]> = {
    NEW: ["ACKNOWLEDGED"],
    ACKNOWLEDGED: ["INVESTIGATING", "DISMISSED"],
    INVESTIGATING: ["RESOLVED", "DISMISSED"],
  };

  const current = await query(`SELECT alert_id, state_id FROM alert WHERE alert_id = $1`, [alertId]);
  if (current.rows.length === 0) return null;

  const allowed = validTransitions[current.rows[0].state_id] || [];
  if (!allowed.includes(newState)) {
    throw new Error(`Cannot transition from ${current.rows[0].state_id} to ${newState}`);
  }

  const updates: string[] = [`state_id = $1`, `row_version = row_version + 1`];
  const params: unknown[] = [newState];
  let idx = 2;

  if (newState === "ACKNOWLEDGED") {
    updates.push(`acknowledged_at = NOW()`);
    updates.push(`assigned_to = COALESCE(assigned_to, $${idx++})`);
    params.push(userId);
  }
  if (newState === "RESOLVED" || newState === "DISMISSED") {
    updates.push(`resolved_at = NOW()`);
    if (notes) {
      updates.push(`resolution_notes = $${idx++}`);
      params.push(notes);
    }
  }

  params.push(alertId);
  const result = await query(
    `UPDATE alert SET ${updates.join(", ")} WHERE alert_id = $${idx}
     RETURNING alert_id, state_id, assigned_to, sla_due_at, resolved_at`,
    params,
  );
  return result.rows[0] || null;
}
