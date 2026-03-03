import { FastifyInstance } from "fastify";
import { query } from "../db";
import { sendError } from "../errors";
import { executeTransition } from "../workflow-bridge";

export async function registerFindingRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/cases/:caseId/findings", {
    schema: { params: { type: "object", additionalProperties: false, required: ["caseId"], properties: { caseId: { type: "string", format: "uuid" } } } },
  }, async (request) => {
    const { caseId } = request.params as { caseId: string };
    const result = await query(
      `SELECT finding_id, case_id, artifact_id, finding_type, severity, title,
              description, state_id, created_at
       FROM ai_finding WHERE case_id = $1 ORDER BY created_at DESC`,
      [caseId],
    );
    return { findings: result.rows, total: result.rows.length };
  });

  app.post("/api/v1/findings/:id/transition", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: { type: "object", additionalProperties: false, required: ["transitionId"], properties: { transitionId: { type: "string" }, remarks: { type: "string" } } },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { transitionId, remarks } = request.body as { transitionId: string; remarks?: string };
    const { userId, roles } = request.authUser!;

    const result = await executeTransition(
      id, "forensic_finding", transitionId, userId, "OFFICER", roles, remarks,
    );
    if (!result.success) {
      return sendError(reply, 409, result.error || "TRANSITION_FAILED", "Finding transition failed");
    }
    return { success: true, newStateId: result.newStateId };
  });
}
