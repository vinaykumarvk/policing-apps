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
        unit: unitId || undefined,
        unitColumn: "unit_id",
      });

      const filterSql = whereClause || (unitId ? `WHERE unit_id = $1` : "");
      const filterParams = whereClause ? params : (unitId ? [unitId] : []);

      const [alertsByState, casesTotal, contentTotal, watchlistsActive, recentAlerts] = await Promise.all([
        query(`SELECT state_id, COUNT(*)::int AS count FROM sm_alert ${filterSql} GROUP BY state_id`, filterParams),
        query(`SELECT COUNT(*)::int AS total FROM case_record ${filterSql}`, filterParams),
        query(`SELECT COUNT(*)::int AS total FROM content_item`, []),
        query(`SELECT COUNT(*)::int AS total FROM watchlist WHERE is_active = TRUE`, []),
        query(`SELECT alert_id, title, priority, state_id, created_at FROM sm_alert ${filterSql} ORDER BY created_at DESC LIMIT 5`, filterParams),
      ]);

      return {
        alertsByState: alertsByState.rows,
        totalCases: casesTotal.rows[0]?.total || 0,
        totalContent: contentTotal.rows[0]?.total || 0,
        activeWatchlists: watchlistsActive.rows[0]?.total || 0,
        recentAlerts: recentAlerts.rows,
      };
    } catch (err: unknown) {
      request.log.error(err, "Failed to fetch dashboard stats");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // GET /api/v1/dashboard/control-room — Control room queue view with SLA countdown
  app.get("/api/v1/dashboard/control-room", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          priority: { type: "string", maxLength: 20 },
          limit: { type: "integer", minimum: 1, maximum: 100, default: 50 },
          offset: { type: "integer", minimum: 0, default: 0 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { priority, limit: rawLimit, offset: rawOffset } = request.query as Record<string, string | undefined>;
      const limit = Math.min(parseInt(rawLimit || "50", 10) || 50, 100);
      const offset = Math.max(parseInt(rawOffset || "0", 10) || 0, 0);

      const result = await query(
        `SELECT a.alert_id, a.alert_ref, a.title, a.priority, a.state_id, a.alert_type,
                a.assigned_to, a.created_at, a.due_at,
                CASE
                  WHEN a.due_at IS NULL THEN 'NO_SLA'
                  WHEN a.due_at < NOW() THEN 'BREACHED'
                  WHEN a.due_at < NOW() + INTERVAL '2 hours' THEN 'AT_RISK'
                  ELSE 'ON_TRACK'
                END AS sla_status,
                CASE
                  WHEN a.due_at IS NOT NULL THEN EXTRACT(EPOCH FROM (a.due_at - NOW()))::int
                  ELSE NULL
                END AS sla_remaining_seconds,
                COUNT(*) OVER() AS total_count
         FROM sm_alert a
         WHERE a.state_id IN ('NEW', 'TRIAGED', 'INVESTIGATING')
           AND ($1::text IS NULL OR a.priority = $1)
         ORDER BY
           CASE a.priority WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END,
           a.due_at ASC NULLS LAST,
           a.created_at ASC
         LIMIT $2 OFFSET $3`,
        [priority || null, limit, offset],
      );

      const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
      return {
        queue: result.rows.map(({ total_count, ...r }: any) => r),
        total,
        timestamp: new Date().toISOString(),
      };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get control room queue");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // ── Scheduled Reports CRUD ──

  app.get("/api/v1/reports/scheduled", async (request) => {
    const result = await query(
      `SELECT report_id, report_type, report_name, cron_expression, last_run_at, next_run_at, config_jsonb, is_active, created_by, created_at
       FROM scheduled_report ORDER BY created_at DESC`,
    );
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
