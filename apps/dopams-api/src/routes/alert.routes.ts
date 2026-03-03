import { FastifyInstance } from "fastify";
import { query } from "../db";
import { sendError, send404 } from "../errors";
import { executeTransition } from "../workflow-bridge";

export async function registerAlertRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/alerts", async () => {
    const result = await query(
      `SELECT alert_id, alert_type, severity, title, description, source_system,
              subject_id, case_id, state_id, assigned_to, acknowledged_at, resolved_at, created_at
       FROM alert ORDER BY created_at DESC`,
    );
    return { alerts: result.rows, total: result.rows.length };
  });

  app.get("/api/v1/alerts/:id", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await query(
      `SELECT alert_id, alert_type, severity, title, description, source_system,
              subject_id, case_id, state_id, row_version, assigned_to,
              acknowledged_by, acknowledged_at, resolved_at, created_at, updated_at
       FROM alert WHERE alert_id = $1`,
      [id],
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
    const { id } = request.params as { id: string };
    const { transitionId, remarks } = request.body as { transitionId: string; remarks?: string };
    const { userId, roles } = request.authUser!;

    const result = await executeTransition(
      id, "dopams_alert", transitionId, userId, "OFFICER", roles, remarks,
    );
    if (!result.success) {
      return sendError(reply, 409, result.error || "TRANSITION_FAILED", "Alert transition failed");
    }
    return { success: true, newStateId: result.newStateId };
  });
}
