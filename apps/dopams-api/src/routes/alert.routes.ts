import { FastifyInstance } from "fastify";
import { query } from "../db";
import { sendError, send404 } from "../errors";
import { executeTransition } from "../workflow-bridge";
import { getAvailableTransitions } from "../workflow-bridge/transitions";
import { createRoleGuard } from "@puda/api-core";

export async function registerAlertRoutes(app: FastifyInstance): Promise<void> {
  const requireAlertAction = createRoleGuard([
    "SUPERVISORY_OFFICER", "ZONAL_OFFICER", "INTELLIGENCE_ANALYST", "ADMINISTRATOR",
  ]);

  app.get("/api/v1/alerts", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          state_id: { type: "string", maxLength: 100 },
          severity: { type: "string", maxLength: 50 },
          alert_type: { type: "string", maxLength: 100 },
          limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
          offset: { type: "integer", minimum: 0, default: 0 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { state_id, severity, alert_type, limit: rawLimit, offset: rawOffset } = request.query as Record<string, string | undefined>;
      const unitId = request.authUser?.unitId || null;
      const limit = Math.min(Math.max(parseInt(rawLimit || "50", 10) || 50, 1), 200);
      const offset = Math.max(parseInt(rawOffset || "0", 10) || 0, 0);

      const result = await query(
        `SELECT alert_id, alert_type, severity, title, description, source_system,
                subject_id, case_id, state_id, assigned_to, acknowledged_at, resolved_at, created_at,
                COUNT(*) OVER() AS total_count
         FROM alert
         WHERE ($1::text IS NULL OR state_id = $1)
           AND ($2::text IS NULL OR severity = $2)
           AND ($3::text IS NULL OR alert_type = $3)
           AND (unit_id = $4::uuid)
         ORDER BY created_at DESC
         LIMIT $5 OFFSET $6`,
        [state_id || null, severity || null, alert_type || null, unitId, limit, offset],
      );
      const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
      return { alerts: result.rows.map(({ total_count, ...r }) => r), total };
    } catch (err) {
      request.log.error(err, "Failed to list alerts");
      reply.code(500).send({ error: "INTERNAL_ERROR", message: "Failed to list alerts" });
    }
  });

  app.get("/api/v1/alerts/facets", async (request, reply) => {
    try {
      const unitId = request.authUser?.unitId || null;
      const [stateRows, severityRows, typeRows] = await Promise.all([
        query(`SELECT state_id AS value, COUNT(*)::int AS count FROM alert WHERE (unit_id = $1::uuid) GROUP BY state_id ORDER BY count DESC`, [unitId]),
        query(`SELECT severity AS value, COUNT(*)::int AS count FROM alert WHERE (unit_id = $1::uuid) GROUP BY severity ORDER BY count DESC`, [unitId]),
        query(`SELECT alert_type AS value, COUNT(*)::int AS count FROM alert WHERE (unit_id = $1::uuid) GROUP BY alert_type ORDER BY count DESC`, [unitId]),
      ]);
      return { facets: { state_id: stateRows.rows, severity: severityRows.rows, alert_type: typeRows.rows } };
    } catch (err) {
      request.log.error(err, "Failed to fetch alert facets");
      reply.code(500).send({ error: "INTERNAL_ERROR", message: "Failed to fetch alert facets" });
    }
  });

  app.get("/api/v1/alerts/:id", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const unitId = request.authUser?.unitId || null;
      const result = await query(
        `SELECT alert_id, alert_type, severity, title, description, source_system,
                subject_id, case_id, state_id, row_version, assigned_to,
                acknowledged_by, acknowledged_at, resolved_at, created_at, updated_at
         FROM alert WHERE alert_id = $1 AND unit_id = $2::uuid`,
        [id, unitId],
      );
      if (result.rows.length === 0) {
        return send404(reply, "ALERT_NOT_FOUND", "Alert not found");
      }
      return { alert: result.rows[0] };
    } catch (err) {
      request.log.error(err, "Failed to fetch alert");
      reply.code(500).send({ error: "INTERNAL_ERROR", message: "Failed to fetch alert" });
    }
  });

  app.post("/api/v1/alerts/:id/transition", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: { type: "object", additionalProperties: false, required: ["transitionId"], properties: { transitionId: { type: "string" }, remarks: { type: "string" } } },
    },
  }, async (request, reply) => {
    if (!requireAlertAction(request, reply)) return;
    try {
      const { id } = request.params as { id: string };
      const { transitionId, remarks } = request.body as { transitionId: string; remarks?: string };
      const { userId, roles } = request.authUser!;

      const result = await executeTransition(
        id, "dopams_alert", transitionId, userId, "OFFICER", roles, remarks,
      );
      if (!result.success) {
        if (result.error === "ENTITY_NOT_FOUND") return send404(reply, "ALERT_NOT_FOUND", "Alert not found");
        return sendError(reply, 409, result.error || "TRANSITION_FAILED", "Alert transition failed");
      }
      return { success: true, newStateId: result.newStateId };
    } catch (err) {
      request.log.error(err, "Failed to transition alert");
      reply.code(500).send({ error: "INTERNAL_ERROR", message: "Failed to transition alert" });
    }
  });

  app.get("/api/v1/alerts/:id/transitions", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const result = await query(`SELECT state_id FROM alert WHERE alert_id = $1`, [id]);
      if (result.rows.length === 0) return send404(reply, "ALERT_NOT_FOUND", "Alert not found");
      return { transitions: getAvailableTransitions("dopams_alert", result.rows[0].state_id) };
    } catch (err) {
      request.log.error(err, "Failed to fetch alert transitions");
      reply.code(500).send({ error: "INTERNAL_ERROR", message: "Failed to fetch alert transitions" });
    }
  });

  // ── Alert Suppression Rules ──

  app.get("/api/v1/alert-suppression-rules", async (request, reply) => {
    try {
      const result = await query(
        `SELECT rule_id, pattern, suppress_until, reason, is_active, created_by, created_at
         FROM alert_suppression_rule WHERE is_active = TRUE ORDER BY created_at DESC`,
      );
      return { rules: result.rows };
    } catch (err) {
      request.log.error(err, "Failed to list suppression rules");
      reply.code(500).send({ error: "INTERNAL_ERROR", message: "Failed to list suppression rules" });
    }
  });

  app.post("/api/v1/alert-suppression-rules", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["pattern", "reason"],
        properties: {
          pattern: { type: "object" },
          suppressUntil: { type: "string", format: "date-time" },
          reason: { type: "string" },
        },
      },
    },
  }, async (request, reply) => {
    if (!requireAlertAction(request, reply)) return;
    try {
      const { pattern, suppressUntil, reason } = request.body as { pattern: Record<string, unknown>; suppressUntil?: string; reason: string };
      const { userId } = request.authUser!;
      const result = await query(
        `INSERT INTO alert_suppression_rule (pattern, suppress_until, reason, created_by)
         VALUES ($1, $2, $3, $4)
         RETURNING rule_id, pattern, suppress_until, reason, is_active, created_at`,
        [JSON.stringify(pattern), suppressUntil || null, reason, userId],
      );
      reply.code(201);
      return { rule: result.rows[0] };
    } catch (err) {
      request.log.error(err, "Failed to create suppression rule");
      reply.code(500).send({ error: "INTERNAL_ERROR", message: "Failed to create suppression rule" });
    }
  });

  app.delete("/api/v1/alert-suppression-rules/:ruleId", {
    schema: { params: { type: "object", required: ["ruleId"], properties: { ruleId: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    if (!requireAlertAction(request, reply)) return;
    try {
      const { ruleId } = request.params as { ruleId: string };
      const result = await query(
        `UPDATE alert_suppression_rule SET is_active = FALSE, updated_at = NOW() WHERE rule_id = $1 RETURNING rule_id`,
        [ruleId],
      );
      if (result.rows.length === 0) return send404(reply, "RULE_NOT_FOUND", "Suppression rule not found");
      return { success: true };
    } catch (err) {
      request.log.error(err, "Failed to delete suppression rule");
      reply.code(500).send({ error: "INTERNAL_ERROR", message: "Failed to delete suppression rule" });
    }
  });

  // Check suppression before creating alert (utility used by other routes/connectors)
  app.post("/api/v1/alerts/check-suppression", {
    schema: {
      body: { type: "object", additionalProperties: false, required: ["alertType", "severity"], properties: {
        alertType: { type: "string" }, severity: { type: "string" }, sourceSystem: { type: "string" },
      } },
    },
  }, async (request, reply) => {
    try {
      const body = request.body as Record<string, string>;
      const rules = await query(
        `SELECT rule_id, pattern, reason FROM alert_suppression_rule
         WHERE is_active = TRUE AND (suppress_until IS NULL OR suppress_until > NOW())`,
      );
      for (const rule of rules.rows) {
        const pattern = typeof rule.pattern === "string" ? JSON.parse(rule.pattern) : rule.pattern;
        const matches = Object.entries(pattern).every(([key, val]) => body[key] === val);
        if (matches) {
          return { suppressed: true, ruleId: rule.rule_id, reason: rule.reason };
        }
      }
      return { suppressed: false };
    } catch (err) {
      request.log.error(err, "Failed to check alert suppression");
      reply.code(500).send({ error: "INTERNAL_ERROR", message: "Failed to check alert suppression" });
    }
  });

  // ══════════════════════════════════════════════════════════════════
  // ENHANCED ALERT ENDPOINTS
  // ══════════════════════════════════════════════════════════════════

  // POST /api/v1/alerts/:id/actions — Alert actions: ACKNOWLEDGE, ESCALATE, SHARE, DISMISS
  app.post("/api/v1/alerts/:id/actions", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: {
        type: "object",
        additionalProperties: false,
        required: ["actionType"],
        properties: {
          actionType: { type: "string", enum: ["ACKNOWLEDGE", "ESCALATE", "SHARE", "DISMISS"] },
          notes: { type: "string", maxLength: 2000 },
          assignTo: { type: "string", format: "uuid" },
          sharedWith: { type: "string", maxLength: 200 },
          shareType: { type: "string", enum: ["INTERNAL", "EXTERNAL_AGENCY"] },
        },
      },
    },
  }, async (request, reply) => {
    if (!requireAlertAction(request, reply)) return;
    try {
      const { id } = request.params as { id: string };
      const { actionType, notes, assignTo, sharedWith, shareType } = request.body as {
        actionType: string; notes?: string; assignTo?: string; sharedWith?: string; shareType?: string;
      };
      const { userId } = request.authUser!;

      // Verify alert exists
      const alertResult = await query(`SELECT alert_id, state_id, severity FROM alert WHERE alert_id = $1`, [id]);
      if (alertResult.rows.length === 0) return send404(reply, "ALERT_NOT_FOUND", "Alert not found");

      switch (actionType) {
        case "ACKNOWLEDGE": {
          await query(
            `UPDATE alert SET state_id = 'ACKNOWLEDGED', assigned_to = COALESCE($1, assigned_to),
                    acknowledged_by = $2, acknowledged_at = NOW(), updated_at = NOW(), row_version = row_version + 1
             WHERE alert_id = $3`,
            [assignTo || userId, userId, id],
          );
          return { success: true, action: "ACKNOWLEDGE", alertId: id };
        }
        case "ESCALATE": {
          const newSeverity = alertResult.rows[0].severity === "HIGH" ? "CRITICAL" : "HIGH";
          await query(
            `UPDATE alert SET severity = $1, assigned_to = $2, state_id = 'ESCALATED',
                    updated_at = NOW(), row_version = row_version + 1
             WHERE alert_id = $3`,
            [newSeverity, assignTo || null, id],
          );
          return { success: true, action: "ESCALATE", alertId: id, newSeverity };
        }
        case "SHARE": {
          if (!sharedWith) return sendError(reply, 400, "MISSING_FIELD", "sharedWith is required for SHARE action");
          await query(
            `INSERT INTO alert_share (alert_id, shared_with, share_type, shared_by, notes)
             VALUES ($1, $2, $3, $4, $5)`,
            [id, sharedWith, shareType || "INTERNAL", userId, notes || null],
          );
          return { success: true, action: "SHARE", alertId: id, sharedWith };
        }
        case "DISMISS": {
          await query(
            `UPDATE alert SET state_id = 'DISMISSED', updated_at = NOW(), row_version = row_version + 1
             WHERE alert_id = $1`,
            [id],
          );
          return { success: true, action: "DISMISS", alertId: id };
        }
        default:
          return sendError(reply, 400, "INVALID_ACTION", `Unknown action: ${actionType}`);
      }
    } catch (err: unknown) {
      request.log.error(err, "Failed to execute alert action");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // GET /api/v1/alerts/:id/shares — List shares for an alert
  app.get("/api/v1/alerts/:id/shares", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const result = await query(
        `SELECT share_id, shared_with, share_type, shared_by, notes, shared_at
         FROM alert_share WHERE alert_id = $1 ORDER BY shared_at DESC`,
        [id],
      );
      return { shares: result.rows };
    } catch (err: unknown) {
      request.log.error(err, "Failed to list alert shares");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // GET /api/v1/alerts/queue/:queueName — Queue-based alert view
  app.get("/api/v1/alerts/queue/:queueName", {
    schema: {
      params: {
        type: "object",
        additionalProperties: false,
        required: ["queueName"],
        properties: {
          queueName: { type: "string", enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW"] },
        },
      },
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
          offset: { type: "integer", minimum: 0, default: 0 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { queueName } = request.params as { queueName: string };
      const { limit: rawLimit, offset: rawOffset } = request.query as Record<string, string | undefined>;
      const unitId = request.authUser?.unitId || null;
      const limit = Math.min(Math.max(parseInt(rawLimit || "50", 10) || 50, 1), 200);
      const offset = Math.max(parseInt(rawOffset || "0", 10) || 0, 0);
      const result = await query(
        `SELECT a.alert_id, a.alert_type, a.severity, a.title, a.description,
                a.state_id, a.assigned_to, a.created_at,
                cr.risk_score,
                COUNT(*) OVER() AS total_count
         FROM alert a
         LEFT JOIN classification_result cr ON cr.entity_type = 'dopams_alert' AND cr.entity_id = a.alert_id
         WHERE a.priority_queue = $1
           AND (a.unit_id = $2::uuid)
           AND a.state_id NOT IN ('DISMISSED', 'CLOSED', 'RESOLVED')
         ORDER BY cr.risk_score DESC NULLS LAST, a.created_at DESC
         LIMIT $3 OFFSET $4`,
        [queueName, unitId, limit, offset],
      );
      const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
      return { queue: queueName, alerts: result.rows.map(({ total_count, ...r }) => r), total };
    } catch (err: unknown) {
      request.log.error(err, "Failed to list alerts by queue");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // POST /api/v1/alerts/:id/recalculate — Re-score risk
  app.post("/api/v1/alerts/:id/recalculate", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
    },
  }, async (request, reply) => {
    if (!requireAlertAction(request, reply)) return;
    try {
      const { id } = request.params as { id: string };
      const result = await query(
        `SELECT alert_id, alert_type, severity, subject_id FROM alert WHERE alert_id = $1`,
        [id],
      );
      if (result.rows.length === 0) return send404(reply, "ALERT_NOT_FOUND", "Alert not found");

      const alert = result.rows[0];

      // Recalculate risk score
      let riskScore = 0;

      // Factor 1: Alert type weight
      if (alert.alert_type === "TERRORISM" || alert.alert_type === "ORGANIZED_CRIME") riskScore += 35;
      else if (alert.alert_type === "DRUG_TRAFFICKING" || alert.alert_type === "ARMS_SMUGGLING") riskScore += 30;
      else if (alert.alert_type === "FINANCIAL_CRIME") riskScore += 20;
      else riskScore += 10;

      // Factor 2: Subject risk score
      if (alert.subject_id) {
        const subjectResult = await query(
          `SELECT risk_score FROM subject_profile WHERE subject_id = $1`,
          [alert.subject_id],
        );
        if (subjectResult.rows.length > 0 && subjectResult.rows[0].risk_score) {
          riskScore += Math.min(subjectResult.rows[0].risk_score * 5, 40);
        }
      }

      // Factor 3: Classification score
      const classResult = await query(
        `SELECT risk_score FROM classification_result WHERE entity_type = 'dopams_alert' AND entity_id = $1 ORDER BY updated_at DESC LIMIT 1`,
        [id],
      );
      if (classResult.rows.length > 0 && classResult.rows[0].risk_score) {
        riskScore += Math.min(parseFloat(classResult.rows[0].risk_score), 25);
      }

      // Determine new severity
      const newSeverity = riskScore >= 80 ? "CRITICAL" : riskScore >= 55 ? "HIGH" : riskScore >= 30 ? "MEDIUM" : "LOW";

      // Priority queue assignment
      const normalizedScore = riskScore / 100;
      const priorityQueue = normalizedScore >= 0.9 ? "CRITICAL"
        : normalizedScore >= 0.7 ? "HIGH"
        : normalizedScore >= 0.4 ? "MEDIUM"
        : "LOW";

      await query(
        `UPDATE alert SET severity = $1, priority_queue = $2, updated_at = NOW() WHERE alert_id = $3`,
        [newSeverity, priorityQueue, id],
      );

      return {
        alertId: id,
        previousSeverity: alert.severity,
        newSeverity,
        priorityQueue,
        riskScore,
        recalculatedAt: new Date().toISOString(),
      };
    } catch (err: unknown) {
      request.log.error(err, "Failed to recalculate alert score");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // POST /api/v1/alerts/:id/convert-to-case — Create case from alert
  app.post("/api/v1/alerts/:id/convert-to-case", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
    },
  }, async (request, reply) => {
    if (!requireAlertAction(request, reply)) return;
    try {
      const { id } = request.params as { id: string };
      const { userId } = request.authUser!;

      const alertResult = await query(
        `SELECT alert_id, title, description, severity, state_id, subject_id
         FROM alert WHERE alert_id = $1`,
        [id],
      );
      if (alertResult.rows.length === 0) return send404(reply, "ALERT_NOT_FOUND", "Alert not found");

      const alert = alertResult.rows[0];
      const terminalStates = ["CONVERTED_TO_CASE", "CLOSED", "RESOLVED", "DISMISSED"];
      if (terminalStates.includes(alert.state_id)) {
        return sendError(reply, 400, "INVALID_STATE", `Alert is in state ${alert.state_id} and cannot be converted`);
      }

      const unitId = request.authUser?.unitId || null;
      const caseResult = await query(
        `INSERT INTO dopams_case (title, description, source_alert_id, priority, state_id, created_by, unit_id)
         VALUES ($1, $2, $3, $4, 'OPEN', $5, $6)
         RETURNING case_id`,
        [alert.title, alert.description || "", id, alert.severity || "MEDIUM", userId, unitId],
      );
      const newCase = caseResult.rows[0];

      // Update alert state
      await query(
        `UPDATE alert SET state_id = 'CONVERTED_TO_CASE', case_id = $1, updated_at = NOW(), row_version = row_version + 1
         WHERE alert_id = $2`,
        [newCase.case_id, id],
      );

      // Link evidence to case
      await query(
        `UPDATE evidence_item SET case_id = $1 WHERE lead_id IN (SELECT lead_id FROM lead WHERE alert_id = $2) AND case_id IS NULL`,
        [newCase.case_id, id],
      ).catch(() => { /* non-critical */ });

      // Audit log
      await query(
        `INSERT INTO audit_log (entity_type, entity_id, event_type, from_state, to_state, actor_type, actor_id, remarks)
         VALUES ('dopams_alert', $1, 'CONVERT_TO_CASE', $2, 'CONVERTED_TO_CASE', 'OFFICER', $3, $4)`,
        [id, alert.state_id, userId, `Converted to case ${newCase.case_id}`],
      );

      return { success: true, case_id: newCase.case_id };
    } catch (err: unknown) {
      request.log.error(err, "Failed to convert alert to case");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // POST /api/v1/alerts/:id/export — Export alert as JSON/CSV
  app.post("/api/v1/alerts/:id/export", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      querystring: { type: "object", additionalProperties: false, properties: { format: { type: "string", enum: ["json", "csv"], default: "json" } } },
    },
  }, async (request, reply) => {
    if (!requireAlertAction(request, reply)) return;
    try {
      const { id } = request.params as { id: string };
      const qs = request.query as { format?: string };
      const { userId } = request.authUser!;

      const result = await query(
        `SELECT a.alert_id, a.alert_type, a.severity, a.title, a.description,
                a.state_id, a.assigned_to, a.created_at, a.updated_at,
                cr.category AS classification_category, cr.risk_score
         FROM alert a
         LEFT JOIN classification_result cr ON cr.entity_type = 'dopams_alert' AND cr.entity_id = a.alert_id
         WHERE a.alert_id = $1`,
        [id],
      );
      if (result.rows.length === 0) return send404(reply, "ALERT_NOT_FOUND", "Alert not found");

      const alert = result.rows[0];

      if (qs.format === "csv") {
        const headers = Object.keys(alert).join(",");
        const values = Object.values(alert).map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",");
        const csv = `${headers}\n${values}`;
        reply.header("Content-Type", "text/csv");
        reply.header("Content-Disposition", `attachment; filename="alert-${id}.csv"`);
        return reply.send(csv);
      }

      return { alert };
    } catch (err: unknown) {
      request.log.error(err, "Failed to export alert");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // POST /api/v1/alerts/:id/false-positive — Mark alert as false positive
  app.post("/api/v1/alerts/:id/false-positive", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: {
        type: "object",
        additionalProperties: false,
        required: ["reason"],
        properties: {
          reason: { type: "string", minLength: 1, maxLength: 2000 },
        },
      },
    },
  }, async (request, reply) => {
    if (!requireAlertAction(request, reply)) return;
    try {
      const { id } = request.params as { id: string };
      const { reason } = request.body as { reason: string };
      const { userId } = request.authUser!;

      const alertResult = await query(`SELECT alert_id, state_id FROM alert WHERE alert_id = $1`, [id]);
      if (alertResult.rows.length === 0) return send404(reply, "ALERT_NOT_FOUND", "Alert not found");

      if (alertResult.rows[0].state_id === "FALSE_POSITIVE") {
        return sendError(reply, 400, "ALREADY_FALSE_POSITIVE", "Alert is already marked as false positive");
      }

      const previousState = alertResult.rows[0].state_id;

      await query(
        `UPDATE alert SET state_id = 'FALSE_POSITIVE', false_positive_reason = $1,
                false_positive_by = $2, false_positive_at = NOW(),
                updated_at = NOW(), row_version = row_version + 1
         WHERE alert_id = $3`,
        [reason, userId, id],
      );

      await query(
        `INSERT INTO audit_log (entity_type, entity_id, event_type, from_state, to_state, actor_type, actor_id, remarks)
         VALUES ('dopams_alert', $1, 'FALSE_POSITIVE', $2, 'FALSE_POSITIVE', 'OFFICER', $3, $4)`,
        [id, previousState, userId, reason],
      );

      return { success: true, alertId: id, newStateId: "FALSE_POSITIVE", reason };
    } catch (err: unknown) {
      request.log.error(err, "Failed to mark alert as false positive");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });
}
