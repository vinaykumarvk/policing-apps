import { FastifyInstance } from "fastify";
import { query } from "../db";
import { sendError } from "../errors";
import { buildFilterClauses } from "@puda/api-integrations";

export async function registerDashboardRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/dashboard/stats", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          dateFrom: { type: "string", format: "date" },
          dateTo: { type: "string", format: "date" },
          status: { type: "string", maxLength: 100 },
          priority: { type: "string", maxLength: 50 },
          district: { type: "string", maxLength: 200 },
          category: { type: "string", maxLength: 100 },
          format: { type: "string", enum: ["json", "csv"] },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const unitId = request.authUser?.unitId || null;
      const qs = request.query as Record<string, string | undefined>;

      const { whereClause, params } = buildFilterClauses({
        dateFrom: qs.dateFrom,
        dateTo: qs.dateTo,
        status: qs.status,
        statusColumn: "state_id",
        priority: qs.priority,
        district: qs.district,
        category: qs.category,
        categoryColumn: "case_type",
        unit: unitId || undefined,
        unitColumn: "unit_id",
      });

      const filterSql = whereClause || (unitId ? `WHERE unit_id = $1` : "");
      const filterParams = whereClause ? params : (unitId ? [unitId] : []);

      const [casesByState, casesByType, evidenceTotal, pendingFindings, draftReports, recentCases] = await Promise.all([
        query(`SELECT state_id, COUNT(*)::int AS count FROM forensic_case ${filterSql} GROUP BY state_id`, filterParams),
        query(`SELECT case_type, COUNT(*)::int AS count FROM forensic_case ${filterSql} GROUP BY case_type`, filterParams),
        query(`SELECT COUNT(*)::int AS total FROM evidence_source ${filterSql}`, filterParams),
        query(`SELECT COUNT(*)::int AS total FROM ai_finding WHERE state_id = 'UNREVIEWED'`, []),
        query(`SELECT COUNT(*)::int AS total FROM report WHERE state_id = 'DRAFT'`, []),
        query(`SELECT case_id, case_number, title, case_type, state_id, priority, created_at FROM forensic_case ${filterSql} ORDER BY created_at DESC LIMIT 5`, filterParams),
      ]);

      const statsData = {
        casesByState: casesByState.rows,
        casesByType: casesByType.rows,
        totalEvidence: evidenceTotal.rows[0]?.total || 0,
        pendingFindings: pendingFindings.rows[0]?.total || 0,
        draftReports: draftReports.rows[0]?.total || 0,
        recentCases: recentCases.rows,
      };

      // FR-15: CSV export support
      if (qs.format === "csv") {
        const csvLines: string[] = [];
        csvLines.push("Section,Key,Value");

        for (const row of casesByState.rows) {
          csvLines.push(`Cases by State,${row.state_id},${row.count}`);
        }
        for (const row of casesByType.rows) {
          csvLines.push(`Cases by Type,${row.case_type || "Unknown"},${row.count}`);
        }
        csvLines.push(`Totals,Total Evidence,${statsData.totalEvidence}`);
        csvLines.push(`Totals,Pending Findings,${statsData.pendingFindings}`);
        csvLines.push(`Totals,Draft Reports,${statsData.draftReports}`);

        csvLines.push("");
        csvLines.push("Recent Cases");
        csvLines.push("Case ID,Case Number,Title,Case Type,State,Priority,Created At");
        for (const c of recentCases.rows) {
          const title = String(c.title || "").replace(/"/g, '""');
          csvLines.push(`${c.case_id},${c.case_number},"${title}",${c.case_type || ""},${c.state_id},${c.priority || ""},${c.created_at}`);
        }

        reply.header("Content-Type", "text/csv");
        reply.header("Content-Disposition", "attachment; filename=\"dashboard-stats.csv\"");
        return reply.send(csvLines.join("\n"));
      }

      return statsData;
    } catch (err: unknown) {
      request.log.error(err, "Failed to fetch dashboard stats");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // ── Scheduled Reports CRUD ──

  app.get("/api/v1/reports/scheduled", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          format: { type: "string", enum: ["json", "csv"] },
        },
      },
    },
  }, async (request, reply) => {
    const qs = request.query as { format?: string };
    const result = await query(
      `SELECT report_id, report_type, report_name, cron_expression, last_run_at, next_run_at, config_jsonb, is_active, created_by, created_at
       FROM scheduled_report ORDER BY created_at DESC`,
    );

    // FR-15: CSV export support
    if (qs.format === "csv") {
      const csvLines: string[] = [];
      csvLines.push("Report ID,Report Type,Report Name,Cron Expression,Last Run,Next Run,Is Active,Created By,Created At");
      for (const r of result.rows) {
        const name = String(r.report_name || "").replace(/"/g, '""');
        csvLines.push(`${r.report_id},${r.report_type},"${name}",${r.cron_expression},${r.last_run_at || ""},${r.next_run_at || ""},${r.is_active},${r.created_by},${r.created_at}`);
      }
      reply.header("Content-Type", "text/csv");
      reply.header("Content-Disposition", "attachment; filename=\"scheduled-reports.csv\"");
      return reply.send(csvLines.join("\n"));
    }

    return { scheduledReports: result.rows };
  });

  app.post("/api/v1/reports/scheduled", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["reportType", "reportName", "cronExpression"],
        properties: {
          reportType: { type: "string" },
          reportName: { type: "string" },
          cronExpression: { type: "string" },
          config: { type: "object" },
        },
      },
    },
  }, async (request, reply) => {
    const { reportType, reportName, cronExpression, config } = request.body as {
      reportType: string; reportName: string; cronExpression: string; config?: Record<string, unknown>;
    };
    const { userId } = request.authUser!;
    const result = await query(
      `INSERT INTO scheduled_report (report_type, report_name, cron_expression, config_jsonb, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING report_id, report_type, report_name, cron_expression, config_jsonb, is_active, created_at`,
      [reportType, reportName, cronExpression, JSON.stringify(config || {}), userId],
    );
    reply.code(201);
    return { scheduledReport: result.rows[0] };
  });

  app.patch("/api/v1/reports/scheduled/:reportId", {
    schema: {
      params: { type: "object", required: ["reportId"], properties: { reportId: { type: "string", format: "uuid" } } },
      body: { type: "object", additionalProperties: false, properties: {
        isActive: { type: "boolean" }, cronExpression: { type: "string" }, config: { type: "object" },
      } },
    },
  }, async (request, reply) => {
    const { reportId } = request.params as { reportId: string };
    const body = request.body as Record<string, unknown>;
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (body.isActive !== undefined) { sets.push(`is_active = $${idx++}`); params.push(body.isActive); }
    if (body.cronExpression) { sets.push(`cron_expression = $${idx++}`); params.push(body.cronExpression); }
    if (body.config) { sets.push(`config_jsonb = $${idx++}`); params.push(JSON.stringify(body.config)); }
    if (sets.length === 0) return { success: true };
    sets.push(`updated_at = NOW()`);
    params.push(reportId);
    const result = await query(
      `UPDATE scheduled_report SET ${sets.join(", ")} WHERE report_id = $${idx} RETURNING report_id, report_type, report_name, is_active`,
      params,
    );
    if (result.rows.length === 0) return sendError(reply, 404, "NOT_FOUND", "Scheduled report not found");
    return { scheduledReport: result.rows[0] };
  });
}
