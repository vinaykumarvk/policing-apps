import { FastifyInstance } from "fastify";
import { query } from "../db";
import { sendError, send404 } from "../errors";
import { executeTransition } from "../workflow-bridge";
import { getAvailableTransitions } from "../workflow-bridge/transitions";

export async function registerReportRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/cases/:caseId/reports", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["caseId"], properties: { caseId: { type: "string", format: "uuid" } } },
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          state_id: { type: "string", maxLength: 100 },
          limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
          offset: { type: "integer", minimum: 0, default: 0 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { caseId } = request.params as { caseId: string };
      const { state_id, limit: rawLimit, offset: rawOffset } = request.query as Record<string, string | undefined>;
      const limit = Math.min(Math.max(parseInt(rawLimit || "50", 10) || 50, 1), 200);
      const offset = Math.max(parseInt(rawOffset || "0", 10) || 0, 0);

      const result = await query(
        `SELECT report_id, case_id, title, report_type, report_ref, state_id, version_number,
                created_by, approved_by, published_at, created_at,
                COUNT(*) OVER() AS total_count
         FROM report
         WHERE case_id = $1
           AND ($2::text IS NULL OR state_id = $2)
         ORDER BY created_at DESC
         LIMIT $3 OFFSET $4`,
        [caseId, state_id || null, limit, offset],
      );
      const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
      return { reports: result.rows.map(({ total_count, ...r }) => r), total };
    } catch (err: unknown) {
      request.log.error(err, "Failed to list reports");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  app.post("/api/v1/reports", {
    schema: { body: { type: "object", additionalProperties: false, required: ["caseId", "title"], properties: { caseId: { type: "string", format: "uuid" }, title: { type: "string" }, templateId: { type: "string" } } } },
  }, async (request, reply) => {
    try {
      const { caseId, title, templateId } = request.body as { caseId: string; title: string; templateId?: string };
      const { userId } = request.authUser!;

      const caseCheck = await query(`SELECT 1 FROM forensic_case WHERE case_id = $1`, [caseId]);
      if (caseCheck.rows.length === 0) {
        return send404(reply, "CASE_NOT_FOUND", "Case not found");
      }

      const refResult = await query(`SELECT 'EF-RPT-' || EXTRACT(YEAR FROM NOW())::text || '-' || LPAD(nextval('forensic_report_ref_seq')::text, 6, '0') AS ref`);
      const reportRef = refResult.rows[0].ref;
      const result = await query(
        `INSERT INTO report (case_id, title, template_id, report_ref, created_by) VALUES ($1, $2, $3, $4, $5)
         RETURNING report_id, case_id, title, report_type, template_id, report_ref, state_id, version_number, created_by, created_at`,
        [caseId, title, templateId || null, reportRef, userId],
      );
      reply.code(201);
      return { report: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to create report");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Export report as PDF (simple text-based PDF)
  app.post("/api/v1/reports/:id/export", {
    schema: { params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const result = await query(
        `SELECT report_id, title, report_type, content_jsonb, state_id, created_by, created_at FROM report WHERE report_id = $1`,
        [id],
      );
      if (result.rows.length === 0) return send404(reply, "REPORT_NOT_FOUND", "Report not found");
      const report = result.rows[0];
      // Generate simple PDF content (plain text representation)
      const pdfContent = [
        `Report: ${report.title}`,
        `ID: ${report.report_id}`,
        `Type: ${report.report_type || "N/A"}`,
        `State: ${report.state_id}`,
        `Created: ${report.created_at}`,
        `---`,
        JSON.stringify(report.content_jsonb || {}, null, 2),
      ].join("\n");
      reply.header("Content-Type", "application/pdf");
      reply.header("Content-Disposition", `attachment; filename="report-${id}.pdf"`);
      // Return text as a basic representation (actual pdfkit would be a runtime dependency)
      return pdfContent;
    } catch (err: unknown) {
      request.log.error(err, "Failed to export report");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  app.get("/api/v1/reports/:id/transitions", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const result = await query(`SELECT state_id FROM report WHERE report_id = $1`, [id]);
      if (result.rows.length === 0) return send404(reply, "REPORT_NOT_FOUND", "Report not found");
      return { transitions: getAvailableTransitions("forensic_report", result.rows[0].state_id) };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get report transitions");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  app.post("/api/v1/reports/:id/transition", {
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
      const stateResult = await query(`SELECT state_id FROM report WHERE report_id = $1`, [id]);
      if (stateResult.rows.length === 0) return send404(reply, "REPORT_NOT_FOUND", "Report not found");
      const available = getAvailableTransitions("forensic_report", stateResult.rows[0].state_id);
      if (!available.some((t) => t.transitionId === transitionId)) {
        return sendError(reply, 400, "INVALID_TRANSITION", "Transition not allowed from current state");
      }

      const result = await executeTransition(
        id, "forensic_report", transitionId, userId, "OFFICER", roles, remarks,
      );
      if (!result.success) {
        return sendError(reply, 409, result.error || "TRANSITION_FAILED", "Report transition failed");
      }
      return { success: true, newStateId: result.newStateId };
    } catch (err: unknown) {
      request.log.error(err, "Failed to execute report transition");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });
}
