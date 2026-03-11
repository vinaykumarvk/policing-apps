import { query } from "../db";

export interface NotificationRuleMatch {
  ruleId: string;
  ruleName: string;
  channel: string;
  template: string;
  recipientRole: string | null;
  recipientUserId: string | null;
  escalationLevel: number;
  escalationTimeoutMinutes: number;
  escalatedFromId: string | null;
}

/**
 * Evaluate notification rules against an entity event.
 * Returns matching rules that should trigger notifications.
 */
export async function evaluateRules(
  entityType: string,
  eventType: string,
  entityData: Record<string, unknown>,
): Promise<NotificationRuleMatch[]> {
  const result = await query(
    `SELECT rule_id, rule_name, conditions, channel, template, recipient_role, recipient_user_id,
            COALESCE(escalation_level, 1) AS escalation_level,
            COALESCE(escalation_timeout_minutes, 60) AS escalation_timeout_minutes,
            escalated_from_id
     FROM notification_rule
     WHERE entity_type = $1 AND event_type = $2 AND is_active = TRUE
     ORDER BY escalation_level ASC`,
    [entityType, eventType],
  );

  const matches: NotificationRuleMatch[] = [];
  for (const rule of result.rows) {
    if (matchesConditions(rule.conditions, entityData)) {
      matches.push({
        ruleId: rule.rule_id,
        ruleName: rule.rule_name,
        channel: rule.channel,
        template: rule.template,
        recipientRole: rule.recipient_role,
        recipientUserId: rule.recipient_user_id,
        escalationLevel: parseInt(String(rule.escalation_level), 10) || 1,
        escalationTimeoutMinutes: parseInt(String(rule.escalation_timeout_minutes), 10) || 60,
        escalatedFromId: rule.escalated_from_id || null,
      });
    }
  }
  return matches;
}

/**
 * Simple condition matcher: checks if all conditions in the rule match entity data.
 * Conditions format: { "field": "value" } or { "field": { "gte": 5 } }
 */
function matchesConditions(conditions: Record<string, unknown>, data: Record<string, unknown>): boolean {
  if (Object.keys(conditions).length === 0) return false;
  for (const [key, expected] of Object.entries(conditions)) {
    const actual = data[key];
    if (typeof expected === "object" && expected !== null && !Array.isArray(expected)) {
      const cond = expected as Record<string, unknown>;
      if (cond.gte !== undefined && (typeof actual !== "number" || actual < (cond.gte as number))) return false;
      if (cond.lte !== undefined && (typeof actual !== "number" || actual > (cond.lte as number))) return false;
      if (cond.in !== undefined && !Array.isArray(cond.in)) return false;
      if (cond.in !== undefined && !(cond.in as unknown[]).includes(actual)) return false;
    } else if (actual !== expected) {
      return false;
    }
  }
  return true;
}

/**
 * Create notifications for matching rules.
 * FR-24: Only fires level-1 (immediate) rules initially. Higher levels
 * are scheduled via escalation_timeout_minutes for auto-escalation.
 */
export async function fireNotifications(
  entityType: string,
  entityId: string,
  eventType: string,
  entityData: Record<string, unknown>,
  actorId: string,
): Promise<number> {
  const matches = await evaluateRules(entityType, eventType, entityData);
  let created = 0;

  // FR-24: Separate rules by escalation level — fire level 1 immediately
  const immediateRules = matches.filter((m) => m.escalationLevel === 1);

  for (const match of immediateRules) {
    // Resolve recipients
    const recipients: string[] = [];

    if (match.recipientUserId) {
      recipients.push(match.recipientUserId);
    }

    if (match.recipientRole) {
      const roleUsers = await query(
        `SELECT u.user_id FROM user_account u
         JOIN user_role ur ON u.user_id = ur.user_id
         JOIN role r ON ur.role_id = r.role_id
         WHERE r.role_key = $1 AND u.is_active = TRUE`,
        [match.recipientRole],
      );
      recipients.push(...roleUsers.rows.map((r) => r.user_id));
    }

    // Create notification for each recipient
    for (const recipientId of [...new Set(recipients)]) {
      if (recipientId === actorId) continue; // Don't notify the actor

      const message = interpolateTemplate(match.template, entityData);
      await query(
        `INSERT INTO notification (user_id, title, message, entity_type, entity_id, channel, delivery_status, rule_id)
         VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', $7)`,
        [recipientId, match.ruleName, message, entityType, entityId, match.channel, match.ruleId],
      );
      created++;
    }
  }

  return created;
}

/**
 * FR-24: Check for unacknowledged notifications whose escalation timeout has elapsed,
 * and fire the next escalation level. Called from the SLA scheduler.
 */
export async function processEscalations(): Promise<number> {
  // Find level-1 notifications that have not been acknowledged within timeout
  const unacknowledged = await query(
    `SELECT n.notification_id, n.entity_type, n.entity_id, n.rule_id,
            nr.escalation_level, nr.escalation_timeout_minutes
     FROM notification n
     JOIN notification_rule nr ON nr.rule_id = n.rule_id
     WHERE n.delivery_status = 'PENDING'
       AND nr.escalation_level < 3
       AND n.created_at + (nr.escalation_timeout_minutes || ' minutes')::interval < NOW()
       AND NOT EXISTS (
         SELECT 1 FROM notification n2
         JOIN notification_rule nr2 ON nr2.rule_id = n2.rule_id
         WHERE n2.entity_type = n.entity_type
           AND n2.entity_id = n.entity_id
           AND nr2.escalation_level > nr.escalation_level
       )
     LIMIT 100`,
  );

  let escalated = 0;

  for (const row of unacknowledged.rows) {
    const nextLevel = (parseInt(String(row.escalation_level), 10) || 1) + 1;

    // Find matching escalation rule at the next level
    const nextRules = await query(
      `SELECT rule_id, rule_name, channel, template, recipient_role, recipient_user_id
       FROM notification_rule
       WHERE entity_type = $1
         AND escalation_level = $2
         AND is_active = TRUE
       LIMIT 1`,
      [row.entity_type, nextLevel],
    );

    if (nextRules.rows.length === 0) continue;

    const nextRule = nextRules.rows[0];
    const recipients: string[] = [];

    if (nextRule.recipient_user_id) {
      recipients.push(nextRule.recipient_user_id);
    }
    if (nextRule.recipient_role) {
      const roleUsers = await query(
        `SELECT u.user_id FROM user_account u
         JOIN user_role ur ON u.user_id = ur.user_id
         JOIN role r ON ur.role_id = r.role_id
         WHERE r.role_key = $1 AND u.is_active = TRUE`,
        [nextRule.recipient_role],
      );
      recipients.push(...roleUsers.rows.map((r: Record<string, unknown>) => r.user_id as string));
    }

    for (const recipientId of [...new Set(recipients)]) {
      await query(
        `INSERT INTO notification (user_id, title, message, entity_type, entity_id, channel, delivery_status, rule_id)
         VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', $7)`,
        [recipientId, `[ESCALATION L${nextLevel}] ${nextRule.rule_name}`, nextRule.template,
         row.entity_type, row.entity_id, nextRule.channel, nextRule.rule_id],
      );
      escalated++;
    }

    // Mark the original notification as escalated
    await query(
      `UPDATE notification SET delivery_status = 'ESCALATED' WHERE notification_id = $1`,
      [row.notification_id],
    );
  }

  return escalated;
}

/**
 * Snooze a notification until a specified time.
 */
export async function snoozeNotification(notificationId: string, snoozedUntil: string): Promise<void> {
  await query(
    `UPDATE notification SET snoozed_until = $1, delivery_status = 'SNOOZED' WHERE notification_id = $2`,
    [snoozedUntil, notificationId],
  );
}

/**
 * Simple template interpolation: replaces {{field}} with entity data values.
 */
function interpolateTemplate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    return data[key] !== undefined ? String(data[key]) : `{{${key}}}`;
  });
}
