import { FastifyInstance } from "fastify";
import { query } from "../db";
import { sendError, send404 } from "../errors";
import { executeTransition } from "../workflow-bridge";
import { getAvailableTransitions } from "../workflow-bridge/transitions";

export async function registerAlertRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/alerts", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          state_id: { type: "string", maxLength: 100 },
          priority: { type: "string", maxLength: 50 },
          alert_type: { type: "string", maxLength: 100 },
          limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
          offset: { type: "integer", minimum: 0, default: 0 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { state_id, priority, alert_type, limit: rawLimit, offset: rawOffset } = request.query as Record<string, string | undefined>;
      const unitId = request.authUser?.unitId || null;
      const limit = Math.min(Math.max(parseInt(rawLimit || "50", 10) || 50, 1), 200);
      const offset = Math.max(parseInt(rawOffset || "0", 10) || 0, 0);
      const result = await query(
        `SELECT alert_id, alert_ref, alert_type, priority, title, description, content_id,
                category_id, state_id, assigned_to, created_at,
                COUNT(*) OVER() AS total_count
         FROM sm_alert
         WHERE ($1::text IS NULL OR state_id = $1)
           AND ($2::text IS NULL OR priority = $2)
           AND ($3::text IS NULL OR alert_type = $3)
           AND ($4::text IS NULL OR unit_id = $4)
         ORDER BY created_at DESC
         LIMIT $5 OFFSET $6`,
        [state_id || null, priority || null, alert_type || null, unitId, limit, offset],
      );
      const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
      return { alerts: result.rows.map(({ total_count, ...r }) => r), total };
    } catch (err: unknown) {
      request.log.error(err, "Failed to list alerts");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  app.get("/api/v1/alerts/:id", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const result = await query(
        `SELECT alert_id, alert_ref, alert_type, priority, title, description, content_id,
                category_id, state_id, row_version, assigned_to, created_at, updated_at
         FROM sm_alert WHERE alert_id = $1`,
        [id],
      );
      if (result.rows.length === 0) {
        return send404(reply, "ALERT_NOT_FOUND", "Alert not found");
      }
      return { alert: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get alert");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  app.get("/api/v1/alerts/:id/transitions", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const result = await query(`SELECT state_id FROM sm_alert WHERE alert_id = $1`, [id]);
      if (result.rows.length === 0) return send404(reply, "ALERT_NOT_FOUND", "Alert not found");
      return { transitions: getAvailableTransitions("sm_alert", result.rows[0].state_id) };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get alert transitions");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  app.post("/api/v1/alerts/:id/transition", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: { type: "object", additionalProperties: false, required: ["transitionId"], properties: { transitionId: { type: "string" }, remarks: { type: "string" } } },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { transitionId, remarks } = request.body as { transitionId: string; remarks?: string };
      const { userId, roles } = request.authUser!;

      // Validate transition is allowed from current state
      const stateResult = await query(`SELECT state_id FROM sm_alert WHERE alert_id = $1`, [id]);
      if (stateResult.rows.length === 0) return send404(reply, "ALERT_NOT_FOUND", "Alert not found");
      const available = getAvailableTransitions("sm_alert", stateResult.rows[0].state_id);
      if (!available.some((t) => t.transitionId === transitionId)) {
        return sendError(reply, 400, "INVALID_TRANSITION", "Transition not allowed from current state");
      }

      const result = await executeTransition(
        id, "sm_alert", transitionId, userId, "OFFICER", roles, remarks,
      );
      if (!result.success) {
        return sendError(reply, 409, result.error || "TRANSITION_FAILED", "Alert transition failed");
      }
      return { success: true, newStateId: result.newStateId };
    } catch (err: unknown) {
      request.log.error(err, "Failed to execute alert transition");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  app.post("/api/v1/alerts/:id/actions", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: { type: "object", additionalProperties: false, required: ["actionType"], properties: { actionType: { type: "string" }, notes: { type: "string" } } },
    },
  }, async (_request, reply) => {
    reply.code(501);
    return { error: "NOT_IMPLEMENTED", message: "Alert action not yet implemented", statusCode: 501 };
  });
}
