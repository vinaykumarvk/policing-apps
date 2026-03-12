import { FastifyInstance } from "fastify";
import { query } from "../db";
import { sendError, send404 } from "../errors";
import { createRoleGuard } from "@puda/api-core";

const requireSupervisor = createRoleGuard(["SUPERVISORY_OFFICER", "ADMINISTRATOR"]);

export async function registerEscalationRoutes(app: FastifyInstance): Promise<void> {

  // POST /api/v1/alerts/:id/escalate — Request escalation for an alert
  app.post("/api/v1/alerts/:id/escalate", {
    schema: {
      params: {
        type: "object",
        additionalProperties: false,
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
      body: {
        type: "object",
        additionalProperties: false,
        required: ["reason"],
        properties: { reason: { type: "string", minLength: 1, maxLength: 2000 } },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { reason } = request.body as { reason: string };
      const { userId } = request.authUser!;

      // Check alert exists and doesn't already have pending escalation
      const alertCheck = await query(
        `SELECT alert_id, pending_approval FROM alert WHERE alert_id = $1`,
        [id],
      );
      if (alertCheck.rows.length === 0) return send404(reply, "ALERT_NOT_FOUND", "Alert not found");
      if (alertCheck.rows[0].pending_approval) {
        return sendError(reply, 409, "ALREADY_PENDING", "Alert already has pending escalation");
      }

      await query(
        `UPDATE alert SET pending_approval = TRUE, escalation_reason = $2,
                approval_requested_by = $3, approval_requested_at = NOW(), updated_at = NOW()
         WHERE alert_id = $1`,
        [id, reason, userId],
      );

      return { success: true };
    } catch (err: unknown) {
      request.log.error(err, "Failed to request escalation");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // POST /api/v1/alerts/:id/escalation/approve — Approve escalation
  app.post("/api/v1/alerts/:id/escalation/approve", {
    schema: {
      params: {
        type: "object",
        additionalProperties: false,
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
    },
  }, async (request, reply) => {
    if (!requireSupervisor(request, reply)) return;
    try {
      const { id } = request.params as { id: string };
      const { userId } = request.authUser!;

      const result = await query(
        `UPDATE alert SET pending_approval = FALSE, state_id = 'ESCALATED',
                escalation_level = COALESCE(escalation_level, 0) + 1,
                approved_by = $2, approved_at = NOW(), updated_at = NOW()
         WHERE alert_id = $1 AND pending_approval = TRUE RETURNING alert_id`,
        [id, userId],
      );
      if (result.rowCount === 0) return send404(reply, "NOT_FOUND", "No pending escalation found");

      return { success: true };
    } catch (err: unknown) {
      request.log.error(err, "Failed to approve escalation");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // POST /api/v1/alerts/:id/escalation/reject — Reject escalation
  app.post("/api/v1/alerts/:id/escalation/reject", {
    schema: {
      params: {
        type: "object",
        additionalProperties: false,
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
    },
  }, async (request, reply) => {
    if (!requireSupervisor(request, reply)) return;
    try {
      const { id } = request.params as { id: string };
      const { userId } = request.authUser!;

      const result = await query(
        `UPDATE alert SET pending_approval = FALSE, approved_by = $2, approved_at = NOW(), updated_at = NOW()
         WHERE alert_id = $1 AND pending_approval = TRUE RETURNING alert_id`,
        [id, userId],
      );
      if (result.rowCount === 0) return send404(reply, "NOT_FOUND", "No pending escalation found");

      return { success: true };
    } catch (err: unknown) {
      request.log.error(err, "Failed to reject escalation");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // GET /api/v1/escalation/queue — Get escalation queue (pending approvals)
  app.get("/api/v1/escalation/queue", {
    schema: {
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
    if (!requireSupervisor(request, reply)) return;
    try {
      const result = await query(
        `SELECT a.alert_id, a.title, a.severity, a.escalation_reason,
                a.approval_requested_by, a.approval_requested_at, a.escalation_level,
                u.full_name AS requested_by_name
         FROM alert a
         LEFT JOIN user_account u ON u.user_id = a.approval_requested_by
         WHERE a.pending_approval = TRUE
         ORDER BY a.approval_requested_at ASC`,
      );
      return { queue: result.rows };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get escalation queue");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // GET /api/v1/sla/rules — List SLA rules
  app.get("/api/v1/sla/rules", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          entityType: { type: "string", maxLength: 50 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { entityType } = request.query as { entityType?: string };
      const result = await query(
        `SELECT * FROM sla_rule WHERE is_active = TRUE AND ($1::text IS NULL OR entity_type = $1) ORDER BY sla_minutes ASC`,
        [entityType || null],
      );
      return { rules: result.rows };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get SLA rules");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // POST /api/v1/sla/rules — Create SLA rule
  app.post("/api/v1/sla/rules", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["priority", "slaMinutes"],
        properties: {
          priority: { type: "string", maxLength: 20 },
          category: { type: "string", maxLength: 100 },
          entityType: { type: "string", maxLength: 50 },
          slaMinutes: { type: "number", minimum: 1 },
          escalateToParent: { type: "boolean" },
        },
      },
    },
  }, async (request, reply) => {
    if (!requireSupervisor(request, reply)) return;
    try {
      const { priority, category, entityType, slaMinutes, escalateToParent } = request.body as {
        priority: string; category?: string; entityType?: string; slaMinutes: number; escalateToParent?: boolean;
      };
      const result = await query(
        `INSERT INTO sla_rule (priority, category, entity_type, sla_minutes, escalate_to_parent)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [priority, category || null, entityType || "dopams_alert", slaMinutes, escalateToParent ?? true],
      );
      reply.code(201);
      return { rule: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to create SLA rule");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // GET /api/v1/dashboard/sla — SLA Dashboard
  app.get("/api/v1/dashboard/sla", async (request, reply) => {
    try {
      const stats = await query(
        `SELECT
           COUNT(*) FILTER (WHERE a.created_at + (sr.sla_minutes || ' minutes')::interval > NOW()) AS on_track,
           COUNT(*) FILTER (WHERE a.created_at + (sr.sla_minutes || ' minutes')::interval <= NOW()
                                AND a.created_at + (sr.sla_minutes || ' minutes')::interval > NOW() - INTERVAL '30 minutes') AS at_risk,
           COUNT(*) FILTER (WHERE a.created_at + (sr.sla_minutes || ' minutes')::interval <= NOW() - INTERVAL '30 minutes') AS breached
         FROM alert a
         JOIN sla_rule sr ON sr.priority = a.severity AND sr.entity_type = 'dopams_alert' AND sr.is_active = TRUE
         WHERE a.state_id NOT IN ('RESOLVED', 'CLOSED')`,
      );
      return { sla: stats.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get SLA dashboard");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });
}
