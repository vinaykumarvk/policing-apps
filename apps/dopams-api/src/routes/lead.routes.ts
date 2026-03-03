import { FastifyInstance } from "fastify";
import { query } from "../db";
import { sendError, send404 } from "../errors";
import { executeTransition } from "../workflow-bridge";

export async function registerLeadRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/leads", async () => {
    const result = await query(
      `SELECT lead_id, source_type, summary, priority, state_id, subject_id,
              assigned_to, created_by, created_at
       FROM lead ORDER BY created_at DESC`,
    );
    return { leads: result.rows, total: result.rows.length };
  });

  app.post("/api/v1/leads", {
    schema: { body: { type: "object", additionalProperties: false, required: ["sourceType", "summary"], properties: { sourceType: { type: "string" }, summary: { type: "string" }, details: { type: "string" } } } },
  }, async (request, reply) => {
    const { sourceType, summary, details } = request.body as { sourceType: string; summary: string; details?: string };
    const { userId } = request.authUser!;
    const result = await query(
      `INSERT INTO lead (source_type, summary, details, created_by) VALUES ($1, $2, $3, $4)
       RETURNING lead_id, source_type, summary, details, priority, state_id, created_by, created_at`,
      [sourceType, summary, details || null, userId],
    );
    reply.code(201);
    return { lead: result.rows[0] };
  });

  app.get("/api/v1/leads/:id", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await query(
      `SELECT lead_id, source_type, summary, details, priority, state_id, row_version,
              subject_id, assigned_to, created_by, created_at, updated_at
       FROM lead WHERE lead_id = $1`,
      [id],
    );
    if (result.rows.length === 0) {
      return send404(reply, "LEAD_NOT_FOUND", "Lead not found");
    }
    return { lead: result.rows[0] };
  });

  app.post("/api/v1/leads/:id/transition", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: { type: "object", additionalProperties: false, required: ["transitionId"], properties: { transitionId: { type: "string" }, remarks: { type: "string" } } },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { transitionId, remarks } = request.body as { transitionId: string; remarks?: string };
    const { userId, roles } = request.authUser!;

    const result = await executeTransition(
      id, "dopams_lead", transitionId, userId, "OFFICER", roles, remarks,
    );
    if (!result.success) {
      return sendError(reply, 409, result.error || "TRANSITION_FAILED", "Lead transition failed");
    }
    return { success: true, newStateId: result.newStateId };
  });
}
