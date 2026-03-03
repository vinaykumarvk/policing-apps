import { FastifyInstance } from "fastify";
import { query } from "../db";
import { sendError, send404 } from "../errors";
import { executeTransition } from "../workflow-bridge";

export async function registerReportRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/v1/reports", {
    schema: { body: { type: "object", additionalProperties: false, required: ["caseId", "title"], properties: { caseId: { type: "string", format: "uuid" }, title: { type: "string" }, templateId: { type: "string" } } } },
  }, async (request, reply) => {
    const { caseId, title, templateId } = request.body as { caseId: string; title: string; templateId?: string };
    const { userId } = request.authUser!;

    const caseCheck = await query(`SELECT 1 FROM case_record WHERE case_id = $1`, [caseId]);
    if (caseCheck.rows.length === 0) {
      return send404(reply, "CASE_NOT_FOUND", "Case not found");
    }

    const result = await query(
      `INSERT INTO report_instance (case_id, title, template_id, created_by) VALUES ($1, $2, $3, $4)
       RETURNING report_id, case_id, title, state_id, created_by, created_at`,
      [caseId, title, templateId || null, userId],
    );
    reply.code(201);
    return { report: result.rows[0] };
  });

  app.get("/api/v1/reports/:id", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await query(
      `SELECT report_id, case_id, template_id, title, content_jsonb, state_id, row_version,
              created_by, approved_by, exported_at, created_at, updated_at
       FROM report_instance WHERE report_id = $1`,
      [id],
    );
    if (result.rows.length === 0) {
      return send404(reply, "REPORT_NOT_FOUND", "Report not found");
    }
    return { report: result.rows[0] };
  });

  app.post("/api/v1/reports/:id/transition", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: { type: "object", additionalProperties: false, required: ["transitionId"], properties: { transitionId: { type: "string" }, remarks: { type: "string" } } },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { transitionId, remarks } = request.body as { transitionId: string; remarks?: string };
    const { userId, roles } = request.authUser!;

    const result = await executeTransition(
      id, "sm_report", transitionId, userId, "OFFICER", roles, remarks,
    );
    if (!result.success) {
      return sendError(reply, 409, result.error || "TRANSITION_FAILED", "Report transition failed");
    }
    return { success: true, newStateId: result.newStateId };
  });
}
