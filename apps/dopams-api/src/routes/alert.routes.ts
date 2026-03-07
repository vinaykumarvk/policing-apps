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
  }, async (request) => {
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
  });

  app.get("/api/v1/alerts/facets", async (request) => {
    const unitId = request.authUser?.unitId || null;
    const [stateRows, severityRows, typeRows] = await Promise.all([
      query(`SELECT state_id AS value, COUNT(*)::int AS count FROM alert WHERE (unit_id = $1::uuid) GROUP BY state_id ORDER BY count DESC`, [unitId]),
      query(`SELECT severity AS value, COUNT(*)::int AS count FROM alert WHERE (unit_id = $1::uuid) GROUP BY severity ORDER BY count DESC`, [unitId]),
      query(`SELECT alert_type AS value, COUNT(*)::int AS count FROM alert WHERE (unit_id = $1::uuid) GROUP BY alert_type ORDER BY count DESC`, [unitId]),
    ]);
    return { facets: { state_id: stateRows.rows, severity: severityRows.rows, alert_type: typeRows.rows } };
  });

  app.get("/api/v1/alerts/:id", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
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
  });

  app.post("/api/v1/alerts/:id/transition", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: { type: "object", additionalProperties: false, required: ["transitionId"], properties: { transitionId: { type: "string" }, remarks: { type: "string" } } },
    },
  }, async (request, reply) => {
    if (!requireAlertAction(request, reply)) return;
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
  });

  app.get("/api/v1/alerts/:id/transitions", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await query(`SELECT state_id FROM alert WHERE alert_id = $1`, [id]);
    if (result.rows.length === 0) return send404(reply, "ALERT_NOT_FOUND", "Alert not found");
    return { transitions: getAvailableTransitions("dopams_alert", result.rows[0].state_id) };
  });

  // ── Alert Suppression Rules ──

  app.get("/api/v1/alert-suppression-rules", async (request) => {
    const result = await query(
      `SELECT rule_id, pattern, suppress_until, reason, is_active, created_by, created_at
       FROM alert_suppression_rule WHERE is_active = TRUE ORDER BY created_at DESC`,
    );
    return { rules: result.rows };
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
  });

  app.delete("/api/v1/alert-suppression-rules/:ruleId", {
    schema: { params: { type: "object", required: ["ruleId"], properties: { ruleId: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    if (!requireAlertAction(request, reply)) return;
    const { ruleId } = request.params as { ruleId: string };
    const result = await query(
      `UPDATE alert_suppression_rule SET is_active = FALSE, updated_at = NOW() WHERE rule_id = $1 RETURNING rule_id`,
      [ruleId],
    );
    if (result.rows.length === 0) return send404(reply, "RULE_NOT_FOUND", "Suppression rule not found");
    return { success: true };
  });

  // Check suppression before creating alert (utility used by other routes/connectors)
  app.post("/api/v1/alerts/check-suppression", {
    schema: {
      body: { type: "object", additionalProperties: false, required: ["alertType", "severity"], properties: {
        alertType: { type: "string" }, severity: { type: "string" }, sourceSystem: { type: "string" },
      } },
    },
  }, async (request) => {
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
  });
}
