import { FastifyInstance } from "fastify";
import { query } from "../db";
import { sendError, send404 } from "../errors";
import { executeTransition } from "../workflow-bridge";
import { getAvailableTransitions } from "../workflow-bridge/transitions";
import { createRoleGuard } from "@puda/api-core";

const requireFindingWrite = createRoleGuard(["EXAMINER", "REVIEWER", "ADMINISTRATOR", "PLATFORM_ADMINISTRATOR"]);

export async function registerFindingRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/cases/:caseId/findings", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["caseId"], properties: { caseId: { type: "string", format: "uuid" } } },
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          severity: { type: "string", maxLength: 50 },
          state_id: { type: "string", maxLength: 100 },
          limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
          offset: { type: "integer", minimum: 0, default: 0 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { caseId } = request.params as { caseId: string };
      const { severity, state_id, limit: rawLimit, offset: rawOffset } = request.query as Record<string, string | undefined>;
      const limit = Math.min(Math.max(parseInt(rawLimit || "50", 10) || 50, 1), 200);
      const offset = Math.max(parseInt(rawOffset || "0", 10) || 0, 0);

      const result = await query(
        `SELECT finding_id, case_id, artifact_id, finding_type, severity, title,
                description, analysis_source, state_id, created_at,
                COUNT(*) OVER() AS total_count
         FROM ai_finding
         WHERE case_id = $1
           AND ($2::text IS NULL OR severity = $2)
           AND ($3::text IS NULL OR state_id = $3)
         ORDER BY created_at DESC
         LIMIT $4 OFFSET $5`,
        [caseId, severity || null, state_id || null, limit, offset],
      );
      const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
      return { findings: result.rows.map(({ total_count, ...r }) => r), total };
    } catch (err: unknown) {
      request.log.error(err, "Failed to list findings");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  app.get("/api/v1/findings/:id/transitions", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const result = await query(`SELECT state_id FROM ai_finding WHERE finding_id = $1`, [id]);
      if (result.rows.length === 0) return send404(reply, "FINDING_NOT_FOUND", "Finding not found");
      return { transitions: getAvailableTransitions("forensic_finding", result.rows[0].state_id) };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get finding transitions");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  app.post("/api/v1/findings/:id/transition", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: { type: "object", additionalProperties: false, required: ["transitionId"], properties: { transitionId: { type: "string" }, remarks: { type: "string" } } },
    },
  }, async (request, reply) => {
    if (!requireFindingWrite(request, reply)) return;
    try {
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
    } catch (err: unknown) {
      request.log.error(err, "Failed to execute finding transition");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });
}
