import { FastifyInstance } from "fastify";
import { query } from "../db";
import { sendError, send404 } from "../errors";
import { executeTransition } from "../workflow-bridge";

export async function registerReportRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/cases/:caseId/reports", {
    schema: { params: { type: "object", additionalProperties: false, required: ["caseId"], properties: { caseId: { type: "string", format: "uuid" } } } },
  }, async (request) => {
    const { caseId } = request.params as { caseId: string };
    const result = await query(
      `SELECT report_id, case_id, title, report_type, state_id, version_number,
              created_by, approved_by, published_at, created_at
       FROM report WHERE case_id = $1 ORDER BY created_at DESC`,
      [caseId],
    );
    return { reports: result.rows, total: result.rows.length };
  });

  app.post("/api/v1/reports", {
    schema: { body: { type: "object", additionalProperties: false, required: ["caseId", "title"], properties: { caseId: { type: "string", format: "uuid" }, title: { type: "string" }, templateId: { type: "string" } } } },
  }, async (request, reply) => {
    const { caseId, title, templateId } = request.body as { caseId: string; title: string; templateId?: string };
    const { userId } = request.authUser!;

    const caseCheck = await query(`SELECT 1 FROM forensic_case WHERE case_id = $1`, [caseId]);
    if (caseCheck.rows.length === 0) {
      return send404(reply, "CASE_NOT_FOUND", "Case not found");
    }

    const result = await query(
      `INSERT INTO report (case_id, title, template_id, created_by) VALUES ($1, $2, $3, $4)
       RETURNING report_id, case_id, title, report_type, template_id, state_id, version_number, created_by, created_at`,
      [caseId, title, templateId || null, userId],
    );
    reply.code(201);
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
      id, "forensic_report", transitionId, userId, "OFFICER", roles, remarks,
    );
    if (!result.success) {
      return sendError(reply, 409, result.error || "TRANSITION_FAILED", "Report transition failed");
    }
    return { success: true, newStateId: result.newStateId };
  });
}
