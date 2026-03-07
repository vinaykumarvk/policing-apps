import { FastifyInstance } from "fastify";
import { query } from "../db";
import { send404, sendError } from "../errors";
import {
  generateFinancialAnalysis,
  evaluateRules,
} from "../services/unocross";
import { createPdfGenerator } from "@puda/api-integrations";

export async function registerUnocrossRoutes(
  app: FastifyInstance,
): Promise<void> {
  // -------------------------------------------------------------------------
  // GET /api/v1/unocross/templates — list Unocross analysis templates
  // -------------------------------------------------------------------------
  app.get(
    "/api/v1/unocross/templates",
    {
      schema: {
        tags: ["unocross"],
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            template_type: { type: "string", maxLength: 50 },
            active_only: { type: "boolean", default: true },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { template_type, active_only } = request.query as {
          template_type?: string;
          active_only?: boolean;
        };

        const activeFilter = active_only !== false;

        const result = await query(
          `SELECT template_id, template_name, template_type, parameters,
                  query_template, is_active, created_at
           FROM unocross_template
           WHERE ($1::text IS NULL OR template_type = $1)
             AND ($2 = false OR is_active = TRUE)
           ORDER BY template_name`,
          [template_type || null, activeFilter],
        );

        return { templates: result.rows };
      } catch (err: unknown) {
        request.log.error(err, "Failed to list Unocross templates");
        return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
      }
    },
  );

  // -------------------------------------------------------------------------
  // POST /api/v1/unocross/templates — create a new template
  // -------------------------------------------------------------------------
  app.post(
    "/api/v1/unocross/templates",
    {
      schema: {
        tags: ["unocross"],
        body: {
          type: "object",
          additionalProperties: false,
          required: ["templateName", "templateType", "queryTemplate"],
          properties: {
            templateName: { type: "string", minLength: 1, maxLength: 255 },
            templateType: {
              type: "string",
              enum: [
                "HAWALA",
                "BENAMI",
                "SHELL_COMPANY",
                "CRYPTO",
                "CUSTOM",
              ],
            },
            parameters: { type: "object" },
            queryTemplate: { type: "string", minLength: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { templateName, templateType, parameters, queryTemplate } =
          request.body as {
            templateName: string;
            templateType: string;
            parameters?: Record<string, unknown>;
            queryTemplate: string;
          };

        const result = await query(
          `INSERT INTO unocross_template
             (template_name, template_type, parameters, query_template)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [
            templateName,
            templateType,
            JSON.stringify(parameters || {}),
            queryTemplate,
          ],
        );

        reply.code(201);
        return { template: result.rows[0] };
      } catch (err: unknown) {
        request.log.error(err, "Failed to create Unocross template");
        return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
      }
    },
  );

  // -------------------------------------------------------------------------
  // POST /api/v1/unocross/analyze/:subjectId — run financial analysis
  // -------------------------------------------------------------------------
  app.post(
    "/api/v1/unocross/analyze/:subjectId",
    {
      schema: {
        tags: ["unocross"],
        params: {
          type: "object",
          additionalProperties: false,
          required: ["subjectId"],
          properties: {
            subjectId: { type: "string", format: "uuid" },
          },
        },
        body: {
          type: "object",
          additionalProperties: false,
          required: ["templateId"],
          properties: {
            templateId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (request, reply) => {
      const { subjectId } = request.params as { subjectId: string };
      const { templateId } = request.body as { templateId: string };

      // Verify subject exists
      const subjectCheck = await query(
        `SELECT subject_id FROM subject_profile WHERE subject_id = $1`,
        [subjectId],
      );
      if (subjectCheck.rows.length === 0) {
        return send404(reply, "SUBJECT_NOT_FOUND", "Subject not found");
      }

      try {
        const { network, ruleResults } = await generateFinancialAnalysis(
          subjectId,
          templateId,
        );

        const triggeredRules = ruleResults.filter((r) => r.triggered);

        return {
          subjectId,
          network,
          ruleResults,
          summary: {
            totalRulesEvaluated: ruleResults.length,
            triggeredCount: triggeredRules.length,
            highestSeverity:
              triggeredRules.length > 0
                ? triggeredRules[0].severity
                : null,
            suspicionScore: network.suspicionScore,
          },
        };
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        if (
          errMsg.includes("not found") ||
          errMsg.includes("inactive")
        ) {
          return send404(reply, "TEMPLATE_NOT_FOUND", errMsg);
        }
        request.log.error(err, "Unocross financial analysis failed");
        return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
      }
    },
  );

  // -------------------------------------------------------------------------
  // GET /api/v1/unocross/rules — list financial analysis rules
  // -------------------------------------------------------------------------
  app.get(
    "/api/v1/unocross/rules",
    {
      schema: {
        tags: ["unocross"],
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            rule_type: { type: "string", maxLength: 50 },
            severity: { type: "string", maxLength: 20 },
            active_only: { type: "boolean", default: true },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { rule_type, severity, active_only } = request.query as {
          rule_type?: string;
          severity?: string;
          active_only?: boolean;
        };

        const activeFilter = active_only !== false;

        const result = await query(
          `SELECT rule_id, rule_name, rule_type, conditions, severity,
                  is_active, created_at
           FROM financial_analysis_rule
           WHERE ($1::text IS NULL OR rule_type = $1)
             AND ($2::text IS NULL OR severity = $2)
             AND ($3 = false OR is_active = TRUE)
           ORDER BY severity DESC, rule_name`,
          [rule_type || null, severity || null, activeFilter],
        );

        return { rules: result.rows };
      } catch (err: unknown) {
        request.log.error(err, "Failed to list financial analysis rules");
        return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
      }
    },
  );

  // -------------------------------------------------------------------------
  // POST /api/v1/unocross/rules — create a financial analysis rule
  // -------------------------------------------------------------------------
  app.post(
    "/api/v1/unocross/rules",
    {
      schema: {
        tags: ["unocross"],
        body: {
          type: "object",
          additionalProperties: false,
          required: ["ruleName", "ruleType", "conditions"],
          properties: {
            ruleName: { type: "string", minLength: 1, maxLength: 255 },
            ruleType: {
              type: "string",
              enum: ["THRESHOLD", "PATTERN", "NETWORK", "ANOMALY"],
            },
            conditions: { type: "object" },
            severity: {
              type: "string",
              enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
              default: "MEDIUM",
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { ruleName, ruleType, conditions, severity } =
          request.body as {
            ruleName: string;
            ruleType: string;
            conditions: Record<string, unknown>;
            severity?: string;
          };

        const result = await query(
          `INSERT INTO financial_analysis_rule
             (rule_name, rule_type, conditions, severity)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [
            ruleName,
            ruleType,
            JSON.stringify(conditions),
            severity || "MEDIUM",
          ],
        );

        reply.code(201);
        return { rule: result.rows[0] };
      } catch (err: unknown) {
        request.log.error(err, "Failed to create financial analysis rule");
        return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
      }
    },
  );

  // -------------------------------------------------------------------------
  // POST /api/v1/unocross/rules/evaluate/:subjectId — evaluate rules only
  // -------------------------------------------------------------------------
  app.post(
    "/api/v1/unocross/rules/evaluate/:subjectId",
    {
      schema: {
        tags: ["unocross"],
        params: {
          type: "object",
          additionalProperties: false,
          required: ["subjectId"],
          properties: {
            subjectId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (request, reply) => {
      const { subjectId } = request.params as { subjectId: string };

      const subjectCheck = await query(
        `SELECT subject_id FROM subject_profile WHERE subject_id = $1`,
        [subjectId],
      );
      if (subjectCheck.rows.length === 0) {
        return send404(reply, "SUBJECT_NOT_FOUND", "Subject not found");
      }

      try {
        const ruleResults = await evaluateRules(subjectId);
        return {
          subjectId,
          ruleResults,
          triggeredCount: ruleResults.filter((r) => r.triggered).length,
        };
      } catch (err: unknown) {
        request.log.error(err, "Rule evaluation failed");
        return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
      }
    },
  );

  // -------------------------------------------------------------------------
  // FR-07 AC-03: POST /api/v1/unocross/drafts — generate draft from template
  // -------------------------------------------------------------------------
  app.post(
    "/api/v1/unocross/drafts",
    {
      schema: {
        tags: ["unocross"],
        body: {
          type: "object",
          additionalProperties: false,
          required: ["templateId", "subjectIds"],
          properties: {
            templateId: { type: "string", format: "uuid" },
            subjectIds: {
              type: "array",
              minItems: 1,
              items: { type: "string", format: "uuid" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { templateId, subjectIds } = request.body as {
          templateId: string;
          subjectIds: string[];
        };
        const { userId } = request.authUser!;

        // Verify template exists
        const tmpl = await query(
          `SELECT template_id, template_name, template_type, parameters, query_template
           FROM unocross_template WHERE template_id = $1 AND is_active = TRUE`,
          [templateId],
        );
        if (tmpl.rows.length === 0) {
          return send404(reply, "TEMPLATE_NOT_FOUND", "Unocross template not found or inactive");
        }

        // Build draft content from template + subjects
        const subjectData: any[] = [];
        for (const sid of subjectIds) {
          const s = await query(
            `SELECT subject_id, full_name, aliases, id_number, profile_data FROM subject_profile WHERE subject_id = $1`,
            [sid],
          );
          if (s.rows.length > 0) subjectData.push(s.rows[0]);
        }

        const content = {
          templateName: tmpl.rows[0].template_name,
          templateType: tmpl.rows[0].template_type,
          parameters: tmpl.rows[0].parameters,
          subjects: subjectData,
          generatedAt: new Date().toISOString(),
        };

        const result = await query(
          `INSERT INTO unocross_draft (template_id, linked_subjects, content_jsonb, created_by)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [templateId, JSON.stringify(subjectIds), JSON.stringify(content), userId],
        );

        reply.code(201);
        return { draft: result.rows[0] };
      } catch (err: unknown) {
        request.log.error(err, "Failed to create Unocross draft");
        return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
      }
    },
  );

  // -------------------------------------------------------------------------
  // GET /api/v1/unocross/drafts — list drafts
  // -------------------------------------------------------------------------
  app.get(
    "/api/v1/unocross/drafts",
    {
      schema: {
        tags: ["unocross"],
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            state_id: { type: "string", maxLength: 20 },
            limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
            offset: { type: "integer", minimum: 0, default: 0 },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const qs = request.query as Record<string, string | undefined>;
        const limit = Math.min(Math.max(parseInt(qs.limit || "50", 10) || 50, 1), 200);
        const offset = Math.max(parseInt(qs.offset || "0", 10) || 0, 0);

        const result = await query(
          `SELECT draft_id, template_id, linked_subjects, state_id, created_by, approved_by, approved_at, created_at,
                  COUNT(*) OVER() AS total_count
           FROM unocross_draft
           WHERE ($1::text IS NULL OR state_id = $1)
           ORDER BY created_at DESC
           LIMIT $2 OFFSET $3`,
          [qs.state_id || null, limit, offset],
        );

        const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
        return { drafts: result.rows.map(({ total_count, ...r }: any) => r), total };
      } catch (err: unknown) {
        request.log.error(err, "Failed to list Unocross drafts");
        return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
      }
    },
  );

  // -------------------------------------------------------------------------
  // FR-07 AC-04: POST /api/v1/unocross/drafts/:id/submit — submit for approval
  // -------------------------------------------------------------------------
  app.post(
    "/api/v1/unocross/drafts/:id/submit",
    {
      schema: {
        tags: ["unocross"],
        params: {
          type: "object",
          additionalProperties: false,
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };

        const current = await query(`SELECT state_id FROM unocross_draft WHERE draft_id = $1`, [id]);
        if (current.rows.length === 0) return send404(reply, "DRAFT_NOT_FOUND", "Draft not found");
        if (current.rows[0].state_id !== "DRAFT") {
          return sendError(reply, 400, "INVALID_STATE", "Only DRAFT documents can be submitted for approval");
        }

        await query(
          `UPDATE unocross_draft SET state_id = 'PENDING_APPROVAL', updated_at = NOW() WHERE draft_id = $1`,
          [id],
        );

        return { success: true, newState: "PENDING_APPROVAL" };
      } catch (err: unknown) {
        request.log.error(err, "Failed to submit draft for approval");
        return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
      }
    },
  );

  // -------------------------------------------------------------------------
  // FR-07 AC-04: POST /api/v1/unocross/drafts/:id/approve — supervisor approval
  // -------------------------------------------------------------------------
  app.post(
    "/api/v1/unocross/drafts/:id/approve",
    {
      schema: {
        tags: ["unocross"],
        params: {
          type: "object",
          additionalProperties: false,
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            approved: { type: "boolean", default: true },
            rejectionReason: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const { approved, rejectionReason } = (request.body || {}) as { approved?: boolean; rejectionReason?: string };
        const { userId } = request.authUser!;

        const current = await query(`SELECT state_id, created_by FROM unocross_draft WHERE draft_id = $1`, [id]);
        if (current.rows.length === 0) return send404(reply, "DRAFT_NOT_FOUND", "Draft not found");
        if (current.rows[0].state_id !== "PENDING_APPROVAL") {
          return sendError(reply, 400, "INVALID_STATE", "Only PENDING_APPROVAL drafts can be approved/rejected");
        }
        // Four-eyes: approver cannot be the creator
        if (current.rows[0].created_by === userId) {
          return sendError(reply, 403, "SELF_APPROVAL_DENIED", "Cannot approve your own draft");
        }

        if (approved !== false) {
          await query(
            `UPDATE unocross_draft SET state_id = 'APPROVED', approved_by = $1, approved_at = NOW(), updated_at = NOW() WHERE draft_id = $2`,
            [userId, id],
          );
          return { success: true, newState: "APPROVED" };
        } else {
          await query(
            `UPDATE unocross_draft SET state_id = 'REJECTED', rejection_reason = $1, updated_at = NOW() WHERE draft_id = $2`,
            [rejectionReason || null, id],
          );
          return { success: true, newState: "REJECTED" };
        }
      } catch (err: unknown) {
        request.log.error(err, "Failed to approve/reject draft");
        return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
      }
    },
  );

  // -------------------------------------------------------------------------
  // FR-07 AC-05: GET /api/v1/unocross/drafts/:id/pdf — export as PDF
  // -------------------------------------------------------------------------
  app.get(
    "/api/v1/unocross/drafts/:id/pdf",
    {
      schema: {
        tags: ["unocross"],
        params: {
          type: "object",
          additionalProperties: false,
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };

        const result = await query(`SELECT * FROM unocross_draft WHERE draft_id = $1`, [id]);
        if (result.rows.length === 0) return send404(reply, "DRAFT_NOT_FOUND", "Draft not found");
        const draft = result.rows[0];
        const content = typeof draft.content_jsonb === "string" ? JSON.parse(draft.content_jsonb) : (draft.content_jsonb || {});

        const subjectEntries = (content.subjects || []).map((s: any) => ({
          label: s.full_name || s.subject_id,
          value: `ID: ${s.id_number || "N/A"}, Aliases: ${(s.aliases || []).join(", ") || "None"}`,
        }));

        const pdfGen = createPdfGenerator();
        const buffer = await pdfGen.generate({
          header: {
            title: "Unocross Financial Analysis Report",
            subtitle: `Template: ${content.templateName || "N/A"} (${content.templateType || "N/A"})`,
            department: "DOPAMS — Drug Operations Planning & Analysis",
            generatedAt: new Date().toISOString(),
            generatedBy: request.authUser?.userId,
            referenceNumber: draft.draft_id,
          },
          sections: [
            {
              type: "keyValue",
              title: "Draft Details",
              entries: [
                { label: "Draft ID", value: draft.draft_id },
                { label: "State", value: draft.state_id },
                { label: "Created By", value: draft.created_by },
                { label: "Approved By", value: draft.approved_by || "N/A" },
                { label: "Created At", value: String(draft.created_at) },
              ],
            },
            ...(subjectEntries.length > 0
              ? [{ type: "keyValue" as const, title: "Linked Subjects", entries: subjectEntries }]
              : []),
            {
              type: "text" as const,
              title: "Analysis Content",
              content: JSON.stringify(content, null, 2),
            },
          ],
          footer: {
            text: "Generated by DOPAMS Unocross Module",
            confidentiality: "CONFIDENTIAL — Financial Intelligence Document",
            pageNumbers: true,
          },
          watermark: draft.state_id === "DRAFT" ? "DRAFT" : undefined,
        });

        reply.header("Content-Type", "application/pdf");
        reply.header("Content-Disposition", `attachment; filename="unocross-draft-${id}.pdf"`);
        return reply.send(buffer);
      } catch (err: unknown) {
        request.log.error(err, "Failed to generate Unocross draft PDF");
        return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
      }
    },
  );
}
