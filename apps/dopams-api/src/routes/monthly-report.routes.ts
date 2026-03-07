import { FastifyInstance } from "fastify";
import { query } from "../db";
import { send400, send404, sendError } from "../errors";
import {
  generateMonthlyReport,
  listMonthlyReports,
  getMonthlyReport,
  getKpiValues,
} from "../services/monthly-report";

export async function registerMonthlyReportRoutes(
  app: FastifyInstance,
): Promise<void> {
  // -------------------------------------------------------------------------
  // GET /api/v1/monthly-reports — list reports (with optional month filter)
  // -------------------------------------------------------------------------
  app.get(
    "/api/v1/monthly-reports",
    {
      schema: {
        tags: ["monthly-reports"],
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            month: {
              type: "string",
              pattern: "^\\d{4}-\\d{2}$",
              description: "Filter by year-month, e.g. 2025-03",
            },
            limit: {
              type: "integer",
              minimum: 1,
              maximum: 200,
              default: 50,
            },
            offset: { type: "integer", minimum: 0, default: 0 },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const {
          month,
          limit: rawLimit,
          offset: rawOffset,
        } = request.query as Record<string, string | undefined>;

        const limit = Math.min(
          Math.max(parseInt(rawLimit || "50", 10) || 50, 1),
          200,
        );
        const offset = Math.max(parseInt(rawOffset || "0", 10) || 0, 0);

        const { reports, total } = await listMonthlyReports(
          month || null,
          limit,
          offset,
        );

        return { reports, total, limit, offset };
      } catch (err: unknown) {
        request.log.error(err, "Failed to list monthly reports");
        return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
      }
    },
  );

  // -------------------------------------------------------------------------
  // GET /api/v1/monthly-reports/:id — single report detail
  // -------------------------------------------------------------------------
  app.get(
    "/api/v1/monthly-reports/:id",
    {
      schema: {
        tags: ["monthly-reports"],
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
        const report = await getMonthlyReport(id);

        if (!report) {
          return send404(
            reply,
            "REPORT_NOT_FOUND",
            "Monthly report not found",
          );
        }

        return { report };
      } catch (err: unknown) {
        request.log.error(err, "Failed to get monthly report");
        return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
      }
    },
  );

  // -------------------------------------------------------------------------
  // POST /api/v1/monthly-reports/generate — trigger report generation
  // -------------------------------------------------------------------------
  app.post(
    "/api/v1/monthly-reports/generate",
    {
      schema: {
        tags: ["monthly-reports"],
        body: {
          type: "object",
          additionalProperties: false,
          required: ["month"],
          properties: {
            month: {
              type: "string",
              pattern: "^\\d{4}-\\d{2}$",
              description: "Year-month for the report, e.g. 2025-03",
            },
            unitId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { month, unitId } = request.body as {
          month: string;
          unitId?: string;
        };

        // Parse month string into a Date — Fastify schema pattern guarantees
        // the format is YYYY-MM, but we still guard against invalid dates.
        const [yearStr, monthStr] = month.split("-");
        const year = parseInt(yearStr, 10);
        const monthIndex = parseInt(monthStr, 10) - 1; // 0-indexed

        if (
          Number.isNaN(year) ||
          Number.isNaN(monthIndex) ||
          monthIndex < 0 ||
          monthIndex > 11
        ) {
          return send400(
            reply,
            "INVALID_MONTH",
            "month must be a valid YYYY-MM string",
          );
        }

        const monthDate = new Date(Date.UTC(year, monthIndex, 1));
        const userId = request.authUser!.userId;

        const result = await generateMonthlyReport(
          monthDate,
          unitId || null,
          userId,
        );

        reply.code(201);
        return { report: result };
      } catch (err: unknown) {
        request.log.error(err, "Failed to generate monthly report");
        return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
      }
    },
  );

  // -------------------------------------------------------------------------
  // PATCH /api/v1/monthly-reports/:id/state — advance report state
  // -------------------------------------------------------------------------
  app.patch(
    "/api/v1/monthly-reports/:id/state",
    {
      schema: {
        tags: ["monthly-reports"],
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
          required: ["stateId"],
          properties: {
            stateId: {
              type: "string",
              enum: ["DRAFT", "GENERATED", "REVIEWED", "PUBLISHED"],
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const { stateId } = request.body as { stateId: string };

        const current = await query(
          `SELECT state_id, row_version FROM monthly_report WHERE report_id = $1`,
          [id],
        );
        if (current.rows.length === 0) {
          return send404(
            reply,
            "REPORT_NOT_FOUND",
            "Monthly report not found",
          );
        }

        const result = await query(
          `UPDATE monthly_report
           SET state_id = $2,
               published_at = CASE WHEN $2 = 'PUBLISHED' THEN NOW() ELSE published_at END,
               row_version = row_version + 1
           WHERE report_id = $1
           RETURNING report_id, state_id, row_version, published_at`,
          [id, stateId],
        );

        return { report: result.rows[0] };
      } catch (err: unknown) {
        request.log.error(err, "Failed to update monthly report state");
        return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
      }
    },
  );

  // -------------------------------------------------------------------------
  // GET /api/v1/kpis — list KPI definitions
  // -------------------------------------------------------------------------
  app.get(
    "/api/v1/kpis",
    {
      schema: {
        tags: ["monthly-reports"],
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            active_only: { type: "boolean", default: true },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { active_only } = request.query as { active_only?: boolean };
        const activeFilter = active_only !== false;

        const result = await query(
          `SELECT kpi_id, kpi_code, kpi_name, description, unit,
                  target_value, is_active, created_at
           FROM kpi_definition
           WHERE ($1 = false OR is_active = TRUE)
           ORDER BY kpi_name`,
          [activeFilter],
        );

        return { kpis: result.rows };
      } catch (err: unknown) {
        request.log.error(err, "Failed to list KPI definitions");
        return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
      }
    },
  );

  // -------------------------------------------------------------------------
  // POST /api/v1/kpis — create a KPI definition
  // -------------------------------------------------------------------------
  app.post(
    "/api/v1/kpis",
    {
      schema: {
        tags: ["monthly-reports"],
        body: {
          type: "object",
          additionalProperties: false,
          required: ["kpiName", "kpiCode", "calculationQuery"],
          properties: {
            kpiName: { type: "string", minLength: 1, maxLength: 255 },
            kpiCode: {
              type: "string",
              minLength: 1,
              maxLength: 100,
              pattern: "^[A-Z0-9_]+$",
            },
            description: { type: "string" },
            calculationQuery: { type: "string", minLength: 1 },
            unit: { type: "string", maxLength: 50, default: "count" },
            targetValue: { type: "number" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const {
          kpiName,
          kpiCode,
          description,
          calculationQuery,
          unit,
          targetValue,
        } = request.body as {
          kpiName: string;
          kpiCode: string;
          description?: string;
          calculationQuery: string;
          unit?: string;
          targetValue?: number;
        };

        const result = await query(
          `INSERT INTO kpi_definition
             (kpi_name, kpi_code, description, calculation_query, unit, target_value)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [
            kpiName,
            kpiCode,
            description || null,
            calculationQuery,
            unit || "count",
            targetValue ?? null,
          ],
        );

        reply.code(201);
        return { kpi: result.rows[0] };
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        if (errMsg.includes("unique") || errMsg.includes("duplicate")) {
          return send400(
            reply,
            "DUPLICATE_KPI_CODE",
            `A KPI with code '${(request.body as { kpiCode: string }).kpiCode}' already exists`,
          );
        }
        request.log.error(err, "Failed to create KPI definition");
        return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
      }
    },
  );

  // -------------------------------------------------------------------------
  // GET /api/v1/kpis/preview — preview KPI values for a given month
  // -------------------------------------------------------------------------
  app.get(
    "/api/v1/kpis/preview",
    {
      schema: {
        tags: ["monthly-reports"],
        querystring: {
          type: "object",
          additionalProperties: false,
          required: ["month"],
          properties: {
            month: {
              type: "string",
              pattern: "^\\d{4}-\\d{2}$",
              description: "Year-month to preview, e.g. 2025-03",
            },
            unit_id: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { month, unit_id } = request.query as {
          month: string;
          unit_id?: string;
        };

        const [yearStr, monthStr] = month.split("-");
        const year = parseInt(yearStr, 10);
        const monthIndex = parseInt(monthStr, 10) - 1;

        if (
          Number.isNaN(year) ||
          Number.isNaN(monthIndex) ||
          monthIndex < 0 ||
          monthIndex > 11
        ) {
          return send400(
            reply,
            "INVALID_MONTH",
            "month must be a valid YYYY-MM string",
          );
        }

        const monthDate = new Date(Date.UTC(year, monthIndex, 1));
        const kpiValues = await getKpiValues(monthDate, unit_id || null);

        return { month, kpiValues };
      } catch (err: unknown) {
        request.log.error(err, "Failed to preview KPI values");
        return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
      }
    },
  );
}
