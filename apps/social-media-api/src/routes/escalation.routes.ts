import { FastifyInstance } from "fastify";
import { query } from "../db";
import { sendError, send404 } from "../errors";
import { createRoleGuard } from "@puda/api-core";
import { requestEscalationApproval, approveEscalation, rejectEscalation } from "../services/auto-escalation";

const requireSupervisor = createRoleGuard(["SUPERVISOR", "PLATFORM_ADMINISTRATOR"]);

export async function registerEscalationRoutes(app: FastifyInstance): Promise<void> {

  // Request escalation for an alert
  app.post("/api/v1/alerts/:id/escalate", {
    schema: {
      params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: { type: "object", required: ["reason"], properties: { reason: { type: "string" } } },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { reason } = request.body as { reason: string };
      const { userId } = request.authUser!;

      const ok = await requestEscalationApproval(id, userId, reason);
      if (!ok) return sendError(reply, 409, "ALREADY_PENDING", "Alert already has pending escalation");
      return { success: true };
    } catch (err: unknown) {
      request.log.error(err, "Failed to request escalation");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Approve escalation
  app.post("/api/v1/alerts/:id/escalation/approve", {
    schema: { params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    if (!requireSupervisor(request, reply)) return;
    try {
      const { id } = request.params as { id: string };
      const { userId } = request.authUser!;
      const ok = await approveEscalation(id, userId);
      if (!ok) return send404(reply, "NOT_FOUND", "No pending escalation found");
      return { success: true };
    } catch (err: unknown) {
      request.log.error(err, "Failed to approve escalation");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Reject escalation
  app.post("/api/v1/alerts/:id/escalation/reject", {
    schema: { params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    if (!requireSupervisor(request, reply)) return;
    try {
      const { id } = request.params as { id: string };
      const { userId } = request.authUser!;
      const ok = await rejectEscalation(id, userId);
      if (!ok) return send404(reply, "NOT_FOUND", "No pending escalation found");
      return { success: true };
    } catch (err: unknown) {
      request.log.error(err, "Failed to reject escalation");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Get escalation queue (pending approvals)
  app.get("/api/v1/escalation/queue", async (request, reply) => {
    if (!requireSupervisor(request, reply)) return;
    try {
      const result = await query(
        `SELECT a.alert_id, a.alert_ref, a.title, a.priority, a.escalation_reason,
                a.approval_requested_by, a.approval_requested_at, a.escalation_level,
                u.full_name AS requested_by_name
         FROM sm_alert a
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

  // SLA rules CRUD
  app.get("/api/v1/sla/rules", async (request, reply) => {
    try {
      const result = await query("SELECT * FROM sla_rule WHERE is_active = TRUE ORDER BY sla_minutes ASC");
      return { rules: result.rows };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get SLA rules");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  app.post("/api/v1/sla/rules", {
    schema: {
      body: {
        type: "object", required: ["priority", "slaMinutes"],
        properties: { priority: { type: "string" }, category: { type: "string" }, entityType: { type: "string" }, slaMinutes: { type: "number" }, escalateToParent: { type: "boolean" } },
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
        [priority, category || null, entityType || "sm_alert", slaMinutes, escalateToParent ?? true],
      );
      reply.code(201);
      return { rule: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to create SLA rule");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // SLA Dashboard
  app.get("/api/v1/dashboard/sla", async (request, reply) => {
    try {
      const stats = await query(
        `SELECT
           COUNT(*) FILTER (WHERE a.created_at + (sr.sla_minutes || ' minutes')::interval > NOW()) AS on_track,
           COUNT(*) FILTER (WHERE a.created_at + (sr.sla_minutes || ' minutes')::interval <= NOW()
                                AND a.created_at + (sr.sla_minutes || ' minutes')::interval > NOW() - INTERVAL '30 minutes') AS at_risk,
           COUNT(*) FILTER (WHERE a.created_at + (sr.sla_minutes || ' minutes')::interval <= NOW() - INTERVAL '30 minutes') AS breached
         FROM sm_alert a
         JOIN sla_rule sr ON sr.priority = a.priority AND sr.entity_type = 'sm_alert' AND sr.is_active = TRUE
         WHERE a.state_id NOT IN ('RESOLVED', 'CLOSED')`,
      );
      return { sla: stats.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get SLA dashboard");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });
}
