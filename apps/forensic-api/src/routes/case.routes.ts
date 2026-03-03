import { FastifyInstance } from "fastify";
import { query } from "../db";
import { sendError, send404 } from "../errors";
import { executeTransition } from "../workflow-bridge";

export async function registerCaseRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/cases", async () => {
    const result = await query(
      `SELECT case_id, case_number, title, case_type, priority, state_id,
              assigned_to, created_by, dopams_case_ref, created_at
       FROM forensic_case ORDER BY created_at DESC`,
    );
    return { cases: result.rows, total: result.rows.length };
  });

  app.post("/api/v1/cases", {
    schema: { body: { type: "object", additionalProperties: false, required: ["title"], properties: { title: { type: "string" }, description: { type: "string" }, caseType: { type: "string" } } } },
  }, async (request, reply) => {
    const { title, description, caseType } = request.body as { title: string; description?: string; caseType?: string };
    const { userId } = request.authUser!;
    const result = await query(
      `INSERT INTO forensic_case (title, description, case_type, created_by) VALUES ($1, $2, $3, $4)
       RETURNING case_id, case_number, title, description, case_type, priority, state_id, created_by, created_at`,
      [title, description || null, caseType || null, userId],
    );
    reply.code(201);
    return { case: result.rows[0] };
  });

  app.get("/api/v1/cases/:id", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await query(
      `SELECT case_id, case_number, title, description, case_type, priority, state_id, row_version,
              assigned_to, created_by, dopams_case_ref, created_at, updated_at
       FROM forensic_case WHERE case_id = $1`,
      [id],
    );
    if (result.rows.length === 0) {
      return send404(reply, "CASE_NOT_FOUND", "Case not found");
    }
    return { case: result.rows[0] };
  });

  app.post("/api/v1/cases/:id/transition", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: { type: "object", additionalProperties: false, required: ["transitionId"], properties: { transitionId: { type: "string" }, remarks: { type: "string" } } },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { transitionId, remarks } = request.body as { transitionId: string; remarks?: string };
    const { userId, roles } = request.authUser!;

    const result = await executeTransition(
      id, "forensic_case", transitionId, userId, "OFFICER", roles, remarks,
    );
    if (!result.success) {
      return sendError(reply, 409, result.error || "TRANSITION_FAILED", "Case transition failed");
    }
    return { success: true, newStateId: result.newStateId };
  });
}
