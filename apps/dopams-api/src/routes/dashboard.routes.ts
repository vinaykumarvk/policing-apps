import { FastifyInstance } from "fastify";
import { query } from "../db";
import { sendError } from "../errors";
import { buildFilterClauses } from "@puda/api-integrations";
import { createRoleGuard } from "@puda/api-core";
import { resolveEntityTable } from "../services/entity-resolver";

export async function registerDashboardRoutes(app: FastifyInstance): Promise<void> {
  const requireDashboardAccess = createRoleGuard([
    "SUPERVISORY_OFFICER", "ZONAL_OFFICER", "INTELLIGENCE_ANALYST", "ADMINISTRATOR",
  ]);

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
    if (!requireDashboardAccess(request, reply)) return;
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

      // When buildFilterClauses returns a WHERE clause, use it directly; otherwise use unit-only filter.
      const filterSql = whereClause || (unitId ? `WHERE unit_id = $1` : "");
      const filterParams = whereClause ? params : (unitId ? [unitId] : []);

      const [alertsBySeverity, leadsByState, casesTotal, subjectsTotal, recentAlerts] = await Promise.all([
        query(`SELECT severity, COUNT(*)::int AS count FROM alert ${filterSql} GROUP BY severity`, filterParams),
        query(`SELECT state_id, COUNT(*)::int AS count FROM lead ${filterSql} GROUP BY state_id`, filterParams),
        query(`SELECT COUNT(*)::int AS total FROM dopams_case ${filterSql}`, filterParams),
        query(`SELECT COUNT(*)::int AS total FROM subject_profile ${filterSql}`, filterParams),
        query(`SELECT alert_id, title, severity, state_id, created_at FROM alert ${filterSql} ORDER BY created_at DESC LIMIT 5`, filterParams),
      ]);

      return {
        alertsBySeverity: alertsBySeverity.rows,
        leadsByState: leadsByState.rows,
        totalCases: casesTotal.rows[0]?.total || 0,
        totalSubjects: subjectsTotal.rows[0]?.total || 0,
        recentAlerts: recentAlerts.rows,
      };
    } catch (err: unknown) {
      request.log.error(err, "Failed to fetch dashboard stats");
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
    if (!requireDashboardAccess(request, reply)) return;
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
    if (!requireDashboardAccess(request, reply)) return;
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

  // ══════════════════════════════════════════════════════════════════
  // ENHANCED DASHBOARD ENDPOINTS
  // ══════════════════════════════════════════════════════════════════

  // GET /api/v1/dashboard/control-room — Priority queue with SLA countdown
  app.get("/api/v1/dashboard/control-room", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          severity: { type: "string", maxLength: 20 },
          limit: { type: "integer", minimum: 1, maximum: 100, default: 50 },
          offset: { type: "integer", minimum: 0, default: 0 },
        },
      },
    },
  }, async (request, reply) => {
    if (!requireDashboardAccess(request, reply)) return;
    try {
      const { severity, limit: rawLimit, offset: rawOffset } = request.query as Record<string, string | undefined>;
      const limit = Math.min(parseInt(rawLimit || "50", 10) || 50, 100);
      const offset = Math.max(parseInt(rawOffset || "0", 10) || 0, 0);

      const result = await query(
        `SELECT a.alert_id, a.title, a.severity, a.state_id, a.alert_type,
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
         FROM alert a
         WHERE a.state_id IN ('NEW', 'ACKNOWLEDGED', 'ESCALATED', 'IN_REVIEW')
           AND ($1::text IS NULL OR a.severity = $1)
         ORDER BY
           CASE a.severity WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END,
           a.due_at ASC NULLS LAST,
           a.created_at ASC
         LIMIT $2 OFFSET $3`,
        [severity || null, limit, offset],
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

  // GET /api/v1/dashboard/analytics — Comprehensive 10-query analytics payload
  app.get("/api/v1/dashboard/analytics", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          dateFrom: { type: "string", format: "date" },
          dateTo: { type: "string", format: "date" },
          granularity: { type: "string", enum: ["daily", "weekly", "monthly"], default: "daily" },
          district: { type: "string", maxLength: 200 },
          severity: { type: "string", maxLength: 50 },
        },
      },
    },
  }, async (request, reply) => {
    if (!requireDashboardAccess(request, reply)) return;
    try {
      const qs = request.query as Record<string, string | undefined>;
      const dateFrom = qs.dateFrom || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const dateTo = qs.dateTo || new Date().toISOString().slice(0, 10);
      const granularity = qs.granularity || "daily";
      const truncUnit = granularity === "monthly" ? "month" : granularity === "weekly" ? "week" : "day";

      const [
        alertTrends,
        caseStages,
        alertStages,
        leadStages,
        categoryDist,
        districtComp,
        slaSummary,
        caseConversion,
        avgResolution,
        subjectRisk,
      ] = await Promise.all([
        // 1. Alert trends (time-series by severity)
        query(
          `SELECT date_trunc($1, created_at)::date AS bucket, severity, COUNT(*)::int AS count
           FROM alert WHERE created_at >= $2::date AND created_at < ($3::date + 1)
           GROUP BY bucket, severity ORDER BY bucket`,
          [truncUnit, dateFrom, dateTo],
        ),
        // 2. Case stage distribution
        query(
          `SELECT state_id, COUNT(*)::int AS count,
             AVG(EXTRACT(EPOCH FROM (NOW() - created_at))/3600)::float AS avg_hours
           FROM dopams_case WHERE state_id NOT IN ('CLOSED','ARCHIVED')
           GROUP BY state_id`,
        ),
        // 3. Alert stage distribution
        query(
          `SELECT state_id, COUNT(*)::int AS count,
             AVG(EXTRACT(EPOCH FROM (NOW() - created_at))/3600)::float AS avg_hours
           FROM alert WHERE state_id NOT IN ('CLOSED','RESOLVED')
           GROUP BY state_id`,
        ),
        // 4. Lead stage distribution
        query(
          `SELECT state_id, COUNT(*)::int AS count,
             AVG(EXTRACT(EPOCH FROM (NOW() - created_at))/3600)::float AS avg_hours
           FROM lead WHERE state_id NOT IN ('CLOSED','CONVERTED')
           GROUP BY state_id`,
        ),
        // 5. Category distribution
        query(
          `SELECT alert_type AS category, COUNT(*)::int AS count
           FROM alert WHERE created_at >= $1::date
           GROUP BY alert_type ORDER BY count DESC LIMIT 15`,
          [dateFrom],
        ),
        // 6. District comparison
        query(
          `SELECT ou.name AS district, ou.unit_id,
             COUNT(DISTINCT a.alert_id)::int AS alert_count,
             COUNT(DISTINCT c.case_id)::int AS case_count,
             COUNT(DISTINCT a.alert_id) FILTER (WHERE a.due_at < NOW() AND a.state_id NOT IN ('CLOSED','RESOLVED'))::int AS breached
           FROM organization_unit ou
           LEFT JOIN alert a ON a.unit_id = ou.unit_id AND a.created_at >= $1::date
           LEFT JOIN dopams_case c ON c.unit_id = ou.unit_id AND c.created_at >= $1::date
           WHERE ou.is_active = TRUE
           GROUP BY ou.unit_id, ou.name ORDER BY alert_count DESC`,
          [dateFrom],
        ),
        // 7. SLA compliance
        query(
          `SELECT COUNT(*) FILTER (WHERE due_at IS NULL OR due_at > NOW())::int AS on_track,
             COUNT(*) FILTER (WHERE due_at <= NOW() + INTERVAL '2h' AND due_at > NOW())::int AS at_risk,
             COUNT(*) FILTER (WHERE due_at < NOW())::int AS breached
           FROM alert WHERE state_id NOT IN ('CLOSED','RESOLVED')`,
        ),
        // 8. Lead-to-case conversion rate
        query(
          `SELECT COUNT(*)::int AS total_leads,
             COUNT(*) FILTER (WHERE state_id = 'CONVERTED')::int AS converted
           FROM lead WHERE created_at >= $1::date`,
          [dateFrom],
        ),
        // 9. Avg resolution time
        query(
          `SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/3600)::float AS avg_hours
           FROM dopams_case WHERE state_id = 'CLOSED' AND updated_at >= $1::date`,
          [dateFrom],
        ),
        // 10. Top risk subjects
        query(
          `SELECT subject_id, full_name, risk_score, created_at
           FROM subject_profile WHERE is_active = TRUE
           ORDER BY risk_score DESC NULLS LAST LIMIT 10`,
        ),
      ]);

      return {
        alertTrends: alertTrends.rows,
        caseStages: caseStages.rows,
        alertStages: alertStages.rows,
        leadStages: leadStages.rows,
        categoryDistribution: categoryDist.rows,
        districtComparison: districtComp.rows,
        sla: slaSummary.rows[0] || { on_track: 0, at_risk: 0, breached: 0 },
        conversion: caseConversion.rows[0] || { total_leads: 0, converted: 0 },
        avgResolutionHours: parseFloat(avgResolution.rows[0]?.avg_hours) || 0,
        topRiskSubjects: subjectRisk.rows,
      };
    } catch (err: unknown) {
      request.log.error(err, "Failed to fetch analytics");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // GET /api/v1/dashboard/trends — Time-series with granularity parameter
  app.get("/api/v1/dashboard/trends", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          granularity: { type: "string", enum: ["hourly", "daily", "weekly", "monthly"], default: "daily" },
          dateFrom: { type: "string", format: "date" },
          dateTo: { type: "string", format: "date" },
          metric: { type: "string", enum: ["alerts", "cases", "leads"], default: "alerts" },
        },
      },
    },
  }, async (request, reply) => {
    if (!requireDashboardAccess(request, reply)) return;
    try {
      const qs = request.query as Record<string, string | undefined>;
      const dateFrom = qs.dateFrom || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const dateTo = qs.dateTo || new Date().toISOString().slice(0, 10);
      const granularity = qs.granularity || "daily";
      const metric = qs.metric || "alerts";
      const truncUnit = granularity === "monthly" ? "month" : granularity === "weekly" ? "week" : granularity === "hourly" ? "hour" : "day";

      let sql: string;
      if (metric === "cases") {
        sql = `SELECT date_trunc($1, created_at)::date AS bucket, state_id AS breakdown, COUNT(*)::int AS count
               FROM dopams_case WHERE created_at >= $2::date AND created_at < ($3::date + 1)
               GROUP BY bucket, state_id ORDER BY bucket`;
      } else if (metric === "leads") {
        sql = `SELECT date_trunc($1, created_at)::date AS bucket, state_id AS breakdown, COUNT(*)::int AS count
               FROM lead WHERE created_at >= $2::date AND created_at < ($3::date + 1)
               GROUP BY bucket, state_id ORDER BY bucket`;
      } else {
        sql = `SELECT date_trunc($1, created_at)::date AS bucket, severity AS breakdown, COUNT(*)::int AS count
               FROM alert WHERE created_at >= $2::date AND created_at < ($3::date + 1)
               GROUP BY bucket, severity ORDER BY bucket`;
      }

      const result = await query(sql, [truncUnit, dateFrom, dateTo]);
      return { trends: result.rows };
    } catch (err: unknown) {
      request.log.error(err, "Failed to fetch trends");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // GET /api/v1/dashboard/pendency — Stage-wise aging with time buckets
  app.get("/api/v1/dashboard/pendency", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          entityType: { type: "string", enum: ["alerts", "cases", "leads"], default: "alerts" },
        },
      },
    },
  }, async (request, reply) => {
    if (!requireDashboardAccess(request, reply)) return;
    try {
      const entityType = (request.query as Record<string, string | undefined>).entityType || "alerts";
      const { table } = resolveEntityTable(entityType);

      const CLOSED_STATES_MAP: Record<string, string[]> = {
        dopams_case: ["CLOSED", "ARCHIVED"],
        lead:        ["CLOSED", "CONVERTED"],
        alert:       ["CLOSED", "RESOLVED"],
      };
      const closedStates = CLOSED_STATES_MAP[table] || ["CLOSED", "RESOLVED"];

      const result = await query(
        `SELECT state_id,
           COUNT(*)::int AS count,
           AVG(EXTRACT(EPOCH FROM (NOW() - created_at))/3600)::float AS avg_hours,
           MIN(EXTRACT(EPOCH FROM (NOW() - created_at))/3600)::float AS min_hours,
           MAX(EXTRACT(EPOCH FROM (NOW() - created_at))/3600)::float AS max_hours,
           COUNT(*) FILTER (WHERE NOW() - created_at < INTERVAL '4h')::int AS bucket_0_4h,
           COUNT(*) FILTER (WHERE NOW() - created_at >= INTERVAL '4h' AND NOW() - created_at < INTERVAL '12h')::int AS bucket_4_12h,
           COUNT(*) FILTER (WHERE NOW() - created_at >= INTERVAL '12h' AND NOW() - created_at < INTERVAL '24h')::int AS bucket_12_24h,
           COUNT(*) FILTER (WHERE NOW() - created_at >= INTERVAL '1d' AND NOW() - created_at < INTERVAL '3d')::int AS bucket_1_3d,
           COUNT(*) FILTER (WHERE NOW() - created_at >= INTERVAL '3d' AND NOW() - created_at < INTERVAL '7d')::int AS bucket_3_7d,
           COUNT(*) FILTER (WHERE NOW() - created_at >= INTERVAL '7d')::int AS bucket_7d_plus
         FROM ${table}
         WHERE state_id NOT IN ($1, $2)
         GROUP BY state_id
         ORDER BY count DESC`,
        closedStates,
      );

      return { stages: result.rows, entityType };
    } catch (err: unknown) {
      request.log.error(err, "Failed to fetch pendency");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // GET /api/v1/dashboard/geo — Geographic distribution per district
  app.get("/api/v1/dashboard/geo", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          dateFrom: { type: "string", format: "date" },
          dateTo: { type: "string", format: "date" },
          alertType: { type: "string", maxLength: 200 },
        },
      },
    },
  }, async (request, reply) => {
    if (!requireDashboardAccess(request, reply)) return;
    try {
      const qs = request.query as Record<string, string | undefined>;
      const dateFrom = qs.dateFrom || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

      const result = await query(
        `SELECT ou.name AS district, ou.unit_id,
           COUNT(DISTINCT a.alert_id)::int AS alert_count,
           COUNT(DISTINCT c.case_id)::int AS case_count,
           COUNT(DISTINCT l.lead_id)::int AS lead_count,
           COUNT(DISTINCT a.alert_id) FILTER (WHERE a.due_at < NOW() AND a.state_id NOT IN ('CLOSED','RESOLVED'))::int AS breach_count
         FROM organization_unit ou
         LEFT JOIN alert a ON a.unit_id = ou.unit_id AND a.created_at >= $1::date
         LEFT JOIN dopams_case c ON c.unit_id = ou.unit_id AND c.created_at >= $1::date
         LEFT JOIN lead l ON l.unit_id = ou.unit_id AND l.created_at >= $1::date
         WHERE ou.is_active = TRUE
         GROUP BY ou.unit_id, ou.name
         ORDER BY alert_count DESC`,
        [dateFrom],
      );

      return { districts: result.rows };
    } catch (err: unknown) {
      request.log.error(err, "Failed to fetch geo data");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // GET /api/v1/dashboard/heatmap — Category x District matrix
  app.get("/api/v1/dashboard/heatmap", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          dateFrom: { type: "string", format: "date" },
          dateTo: { type: "string", format: "date" },
        },
      },
    },
  }, async (request, reply) => {
    if (!requireDashboardAccess(request, reply)) return;
    try {
      const qs = request.query as Record<string, string | undefined>;
      const dateFrom = qs.dateFrom || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

      const result = await query(
        `SELECT ou.name AS district, COALESCE(a.alert_type, 'Uncategorized') AS category, COUNT(*)::int AS count
         FROM alert a
         JOIN organization_unit ou ON ou.unit_id = a.unit_id
         WHERE a.created_at >= $1::date AND ou.is_active = TRUE
         GROUP BY ou.name, a.alert_type
         ORDER BY ou.name, count DESC`,
        [dateFrom],
      );

      // Pivot into matrix
      const districtSet = new Set<string>();
      const categorySet = new Set<string>();
      const counts = new Map<string, number>();
      for (const row of result.rows) {
        districtSet.add(row.district);
        categorySet.add(row.category);
        counts.set(`${row.district}|${row.category}`, row.count);
      }
      const districts = [...districtSet];
      const categories = [...categorySet];
      const values = districts.map((d) => categories.map((c) => counts.get(`${d}|${c}`) || 0));

      return { districts, categories, values };
    } catch (err: unknown) {
      request.log.error(err, "Failed to fetch heatmap");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });
}
