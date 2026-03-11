import { FastifyInstance } from "fastify";
import { query } from "../db";
import { send400, send404, sendError } from "../errors";
import { createPdfGenerator } from "@puda/api-integrations";

export async function registerInterrogationRoutes(app: FastifyInstance): Promise<void> {
  // ---------------------------------------------------------------------------
  // GET /api/v1/interrogation-reports — paginated list with optional filters
  // ---------------------------------------------------------------------------
  app.get(
    "/api/v1/interrogation-reports",
    {
      schema: {
        tags: ["interrogation"],
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            subject_id: { type: "string", format: "uuid" },
            case_id: { type: "string", format: "uuid" },
            state_id: { type: "string", maxLength: 50 },
            limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
            offset: { type: "integer", minimum: 0, default: 0 },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { subject_id, case_id, state_id, limit: rawLimit, offset: rawOffset } =
          request.query as Record<string, string | undefined>;

        const limit = Math.min(Math.max(parseInt(rawLimit || "50", 10) || 50, 1), 200);
        const offset = Math.max(parseInt(rawOffset || "0", 10) || 0, 0);

        const result = await query(
          `SELECT report_id, report_ref, subject_id, case_id, template_id,
                  interrogation_date, location, officer_id, state_id,
                  created_at, updated_at,
                  COUNT(*) OVER() AS total_count
           FROM interrogation_report
           WHERE ($1::uuid IS NULL OR subject_id = $1::uuid)
             AND ($2::uuid IS NULL OR case_id = $2::uuid)
             AND ($3::text IS NULL OR state_id = $3)
           ORDER BY interrogation_date DESC, created_at DESC
           LIMIT $4 OFFSET $5`,
          [subject_id || null, case_id || null, state_id || null, limit, offset],
        );

        const total = result.rows.length > 0
          ? parseInt(String(result.rows[0].total_count), 10)
          : 0;
        const reports = result.rows.map(({ total_count: _, ...r }) => r);

        return { reports, total, limit, offset };
      } catch (err: unknown) {
        request.log.error(err, "Failed to list interrogation reports");
        return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
      }
    },
  );

  // ---------------------------------------------------------------------------
  // GET /api/v1/interrogation-reports/:id — detail with questions_answers
  // ---------------------------------------------------------------------------
  app.get(
    "/api/v1/interrogation-reports/:id",
    {
      schema: {
        tags: ["interrogation"],
        params: {
          type: "object",
          additionalProperties: false,
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };

        const result = await query(
          `SELECT report_id, report_ref, subject_id, case_id, template_id,
                  interrogation_date, location, officer_id, witness_ids,
                  questions_answers, summary, state_id, row_version,
                  created_at, updated_at
           FROM interrogation_report
           WHERE report_id = $1`,
          [id],
        );

        if (result.rows.length === 0) {
          return send404(reply, "REPORT_NOT_FOUND", "Interrogation report not found");
        }

        return { report: result.rows[0] };
      } catch (err: unknown) {
        request.log.error(err, "Failed to get interrogation report");
        return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
      }
    },
  );

  // ---------------------------------------------------------------------------
  // POST /api/v1/interrogation-reports — create a new interrogation report
  // ---------------------------------------------------------------------------
  app.post(
    "/api/v1/interrogation-reports",
    {
      schema: {
        tags: ["interrogation"],
        body: {
          type: "object",
          additionalProperties: false,
          required: ["subjectId", "caseId", "interrogationDate", "questionsAnswers"],
          properties: {
            subjectId: { type: "string", format: "uuid" },
            caseId: { type: "string", format: "uuid" },
            templateId: { type: "string", format: "uuid" },
            interrogationDate: { type: "string", format: "date-time" },
            location: { type: "string", maxLength: 500 },
            witnessIds: {
              type: "array",
              items: { type: "string", format: "uuid" },
            },
            questionsAnswers: {
              type: "array",
              items: {
                type: "object",
                required: ["question", "answer"],
                properties: {
                  question: { type: "string" },
                  answer: { type: "string" },
                  sequence: { type: "integer" },
                },
              },
            },
            summary: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const {
          subjectId,
          caseId,
          templateId,
          interrogationDate,
          location,
          witnessIds,
          questionsAnswers,
          summary,
        } = request.body as {
          subjectId: string;
          caseId: string;
          templateId?: string;
          interrogationDate: string;
          location?: string;
          witnessIds?: string[];
          questionsAnswers: Array<{ question: string; answer: string; sequence?: number }>;
          summary?: string;
        };

        const officerId = request.authUser!.userId;

        // Generate reference number
        const refResult = await query(
          `SELECT 'DOP-IR-' || EXTRACT(YEAR FROM NOW())::text || '-' || LPAD(nextval('dopams_interrogation_ref_seq')::text, 6, '0') AS ref`,
        );
        const reportRef: string = refResult.rows.length > 0
          ? String(refResult.rows[0].ref)
          : `DOP-IR-${Date.now()}`;

        const result = await query(
          `INSERT INTO interrogation_report
             (report_ref, subject_id, case_id, template_id, interrogation_date,
              location, officer_id, witness_ids, questions_answers, summary)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING report_id, report_ref, subject_id, case_id, template_id,
                     interrogation_date, location, officer_id, witness_ids,
                     questions_answers, summary, state_id, created_at`,
          [
            reportRef,
            subjectId,
            caseId,
            templateId || null,
            interrogationDate,
            location || null,
            officerId,
            JSON.stringify(witnessIds || []),
            JSON.stringify(questionsAnswers),
            summary || null,
          ],
        );

        reply.code(201);
        return { report: result.rows[0] };
      } catch (err: unknown) {
        request.log.error(err, "Failed to create interrogation report");
        return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
      }
    },
  );

  // ---------------------------------------------------------------------------
  // PATCH /api/v1/interrogation-reports/:id — update questionsAnswers, summary
  // ---------------------------------------------------------------------------
  app.patch(
    "/api/v1/interrogation-reports/:id",
    {
      schema: {
        tags: ["interrogation"],
        params: {
          type: "object",
          additionalProperties: false,
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            questionsAnswers: {
              type: "array",
              items: {
                type: "object",
                required: ["question", "answer"],
                properties: {
                  question: { type: "string" },
                  answer: { type: "string" },
                  sequence: { type: "integer" },
                },
              },
            },
            summary: { type: "string" },
            location: { type: "string", maxLength: 500 },
            witnessIds: {
              type: "array",
              items: { type: "string", format: "uuid" },
            },
            stateId: {
              type: "string",
              enum: ["DRAFT", "COMPLETED", "REVIEWED", "SIGNED"],
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const body = request.body as {
          questionsAnswers?: Array<{ question: string; answer: string; sequence?: number }>;
          summary?: string;
          location?: string;
          witnessIds?: string[];
          stateId?: string;
        };

        // Verify the report exists
        const existing = await query(
          `SELECT report_id, state_id FROM interrogation_report WHERE report_id = $1`,
          [id],
        );
        if (existing.rows.length === 0) {
          return send404(reply, "REPORT_NOT_FOUND", "Interrogation report not found");
        }

        const currentState = String(existing.rows[0].state_id);
        if (currentState === "SIGNED" && !body.stateId) {
          return send400(reply, "REPORT_SIGNED", "A signed report cannot be modified");
        }

        // Build dynamic SET clause
        const setClauses: string[] = ["updated_at = NOW()", "row_version = row_version + 1"];
        const params: unknown[] = [id];
        let idx = 2;

        if (body.questionsAnswers !== undefined) {
          setClauses.push(`questions_answers = $${idx++}`);
          params.push(JSON.stringify(body.questionsAnswers));
        }
        if (body.summary !== undefined) {
          setClauses.push(`summary = $${idx++}`);
          params.push(body.summary);
        }
        if (body.location !== undefined) {
          setClauses.push(`location = $${idx++}`);
          params.push(body.location);
        }
        if (body.witnessIds !== undefined) {
          setClauses.push(`witness_ids = $${idx++}`);
          params.push(JSON.stringify(body.witnessIds));
        }
        if (body.stateId !== undefined) {
          setClauses.push(`state_id = $${idx++}`);
          params.push(body.stateId);
        }

        if (setClauses.length === 2) {
          // Only timestamps — nothing to update
          return send400(reply, "NO_CHANGES", "No updatable fields provided");
        }

        const result = await query(
          `UPDATE interrogation_report
           SET ${setClauses.join(", ")}
           WHERE report_id = $1
           RETURNING report_id, report_ref, subject_id, case_id,
                     interrogation_date, location, officer_id, witness_ids,
                     questions_answers, summary, state_id, row_version,
                     created_at, updated_at`,
          params,
        );

        return { report: result.rows[0] };
      } catch (err: unknown) {
        request.log.error(err, "Failed to update interrogation report");
        return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
      }
    },
  );

  // Report template CRUD routes are in report-template.routes.ts

  // ---------------------------------------------------------------------------
  // GET /api/v1/interrogation-reports/:id/pdf — FR-08 AC-04 PDF export
  // ---------------------------------------------------------------------------
  app.get("/api/v1/interrogation-reports/:id/pdf", {
    schema: {
      tags: ["interrogation"],
      params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const result = await query(
        `SELECT report_id, subject_id, case_id, template_id, title, content_jsonb, state_id,
                conducted_by, conducted_at, location, duration_minutes, created_by, created_at
         FROM interrogation_report WHERE report_id = $1`,
        [id],
      );
      if (result.rows.length === 0) return send404(reply, "REPORT_NOT_FOUND", "Interrogation report not found");
      const report = result.rows[0];
      const content = report.content_jsonb || {};

      const sections: Array<{ type: "text" | "keyValue"; title?: string; content?: string; entries?: Array<{ label: string; value: string }> }> = [];
      sections.push({
        type: "keyValue" as const,
        title: "Interrogation Details",
        entries: [
          { label: "Report ID", value: report.report_id },
          { label: "Subject ID", value: report.subject_id || "N/A" },
          { label: "Case ID", value: report.case_id || "N/A" },
          { label: "State", value: report.state_id },
          { label: "Conducted By", value: report.conducted_by || "N/A" },
          { label: "Conducted At", value: report.conducted_at ? String(report.conducted_at) : "N/A" },
          { label: "Location", value: report.location || "N/A" },
          { label: "Duration (min)", value: report.duration_minutes ? String(report.duration_minutes) : "N/A" },
        ],
      });
      if (content.questions) {
        sections.push({ type: "text" as const, title: "Questions & Answers", content: JSON.stringify(content.questions, null, 2) });
      }
      if (content.observations) {
        sections.push({ type: "text" as const, title: "Observations", content: content.observations });
      }
      if (content.conclusion) {
        sections.push({ type: "text" as const, title: "Conclusion", content: content.conclusion });
      }

      const template = {
        header: {
          title: report.title || "Interrogation Report",
          subtitle: `DOPAMS Interrogation Report — ${report.report_id}`,
          department: "Drug Operations Planning & Analysis",
          generatedAt: new Date().toISOString(),
          generatedBy: report.created_by,
        },
        sections,
        footer: {
          text: "Generated by DOPAMS",
          confidentiality: "CONFIDENTIAL — For authorized personnel only",
          pageNumbers: true,
        },
        watermark: report.state_id === "DRAFT" ? "DRAFT" : undefined,
      };

      const pdfGen = createPdfGenerator();
      const buffer = await pdfGen.generate(template);
      reply.header("Content-Type", "application/pdf");
      reply.header("Content-Disposition", `attachment; filename="interrogation-${id}.pdf"`);
      return reply.send(buffer);
    } catch (err: unknown) {
      request.log.error(err, "Failed to generate interrogation PDF");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });
}
