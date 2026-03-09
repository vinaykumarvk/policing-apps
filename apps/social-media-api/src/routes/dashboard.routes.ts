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

      const filterSql = whereClause || (unitId ? `WHERE (unit_id = $1 OR unit_id IN (SELECT unit_id FROM organization_unit WHERE parent_unit_id = $1::uuid))` : "");
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
         WHERE a.state_id IN ('NEW', 'TRIAGED', 'IN_REVIEW', 'ESCALATED_SUPERVISOR', 'ESCALATED_CONTROL_ROOM')
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

  // ── Analytics Endpoints ──

  // GET /api/v1/dashboard/analytics — Comprehensive analytics payload
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
          priority: { type: "string", maxLength: 50 },
          platform: { type: "string", maxLength: 200 },
        },
      },
    },
  }, async (request, reply) => {
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
        platformDist,
        categoryDist,
        districtComp,
        topActors,
        slaSummary,
        conversionRate,
        avgResolution,
      ] = await Promise.all([
        // Alert trends (time-series by priority)
        query(
          `SELECT date_trunc($1, created_at)::date AS bucket, priority, COUNT(*)::int AS count
           FROM sm_alert WHERE created_at >= $2::date AND created_at < ($3::date + 1)
           GROUP BY bucket, priority ORDER BY bucket`,
          [truncUnit, dateFrom, dateTo],
        ),
        // Case stage distribution (pendency)
        query(
          `SELECT state_id, COUNT(*)::int AS count,
             AVG(EXTRACT(EPOCH FROM (NOW() - created_at))/3600)::float AS avg_hours
           FROM case_record WHERE state_id NOT IN ('CLOSED','ARCHIVED')
           GROUP BY state_id`,
        ),
        // Alert stage distribution
        query(
          `SELECT state_id, COUNT(*)::int AS count,
             AVG(EXTRACT(EPOCH FROM (NOW() - created_at))/3600)::float AS avg_hours
           FROM sm_alert WHERE state_id NOT IN ('CLOSED_NO_ACTION','CLOSED_ACTIONED','FALSE_POSITIVE')
           GROUP BY state_id`,
        ),
        // Platform distribution (normalized to lowercase, limited to key platforms)
        query(
          `SELECT LOWER(platform) AS platform, COUNT(*)::int AS count FROM content_item
           WHERE ingested_at >= $1::date AND LOWER(platform) IN ('reddit','x','facebook','instagram','telegram','youtube')
           GROUP BY LOWER(platform) ORDER BY count DESC`,
          [dateFrom],
        ),
        // Category distribution
        query(
          `SELECT COALESCE(tc.name, 'Uncategorized') AS category, COUNT(*)::int AS count
           FROM sm_alert a LEFT JOIN taxonomy_category tc ON tc.category_id = a.category_id
           WHERE a.created_at >= $1::date GROUP BY tc.name ORDER BY count DESC LIMIT 15`,
          [dateFrom],
        ),
        // District comparison
        query(
          `SELECT ou.name AS district, ou.unit_id,
             COUNT(DISTINCT a.alert_id)::int AS alert_count,
             COUNT(DISTINCT c.case_id)::int AS case_count,
             COUNT(DISTINCT a.alert_id) FILTER (WHERE a.due_at < NOW() AND a.state_id NOT IN ('CLOSED_NO_ACTION','CLOSED_ACTIONED','FALSE_POSITIVE'))::int AS breached
           FROM organization_unit ou
           LEFT JOIN sm_alert a ON a.unit_id = ou.unit_id AND a.created_at >= $1::date
           LEFT JOIN case_record c ON c.unit_id = ou.unit_id AND c.created_at >= $1::date
           WHERE ou.is_active = TRUE
           GROUP BY ou.unit_id, ou.name ORDER BY alert_count DESC`,
          [dateFrom],
        ),
        // Top actors (risk leaderboard)
        query(
          `SELECT actor_id, canonical_name, display_name, risk_score, total_flagged_posts, is_repeat_offender
           FROM actor_account WHERE is_active = TRUE ORDER BY risk_score DESC NULLS LAST LIMIT 10`,
        ),
        // SLA compliance summary
        query(
          `SELECT COUNT(*) FILTER (WHERE due_at IS NULL OR due_at > NOW())::int AS on_track,
             COUNT(*) FILTER (WHERE due_at <= NOW() + INTERVAL '2h' AND due_at > NOW())::int AS at_risk,
             COUNT(*) FILTER (WHERE due_at < NOW())::int AS breached
           FROM sm_alert
           WHERE state_id NOT IN ('CLOSED_NO_ACTION','CLOSED_ACTIONED','FALSE_POSITIVE')`,
        ),
        // Case conversion rate
        query(
          `SELECT COUNT(*)::int AS total_alerts,
             COUNT(*) FILTER (WHERE state_id = 'CONVERTED_TO_CASE')::int AS converted
           FROM sm_alert WHERE created_at >= $1::date`,
          [dateFrom],
        ),
        // Avg resolution time
        query(
          `SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/3600)::float AS avg_hours
           FROM case_record WHERE state_id = 'CLOSED' AND updated_at >= $1::date`,
          [dateFrom],
        ),
      ]);

      return {
        alertTrends: alertTrends.rows,
        caseStages: caseStages.rows,
        alertStages: alertStages.rows,
        platformDistribution: platformDist.rows,
        categoryDistribution: categoryDist.rows,
        districtComparison: districtComp.rows,
        topActors: topActors.rows,
        sla: slaSummary.rows[0] || { on_track: 0, at_risk: 0, breached: 0 },
        conversion: conversionRate.rows[0] || { total_alerts: 0, converted: 0 },
        avgResolutionHours: parseFloat(avgResolution.rows[0]?.avg_hours) || 0,
      };
    } catch (err: unknown) {
      request.log.error(err, "Failed to fetch analytics");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // GET /api/v1/dashboard/trends — Time-series trend data
  app.get("/api/v1/dashboard/trends", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          granularity: { type: "string", enum: ["hourly", "daily", "weekly", "monthly"], default: "daily" },
          dateFrom: { type: "string", format: "date" },
          dateTo: { type: "string", format: "date" },
          metric: { type: "string", enum: ["alerts", "cases", "content"], default: "alerts" },
        },
      },
    },
  }, async (request, reply) => {
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
               FROM case_record WHERE created_at >= $2::date AND created_at < ($3::date + 1)
               GROUP BY bucket, state_id ORDER BY bucket`;
      } else if (metric === "content") {
        sql = `SELECT date_trunc($1, ingested_at)::date AS bucket, LOWER(platform) AS breakdown, COUNT(*)::int AS count
               FROM content_item WHERE ingested_at >= $2::date AND ingested_at < ($3::date + 1)
                 AND LOWER(platform) IN ('reddit','x','facebook','instagram','telegram','youtube')
               GROUP BY bucket, LOWER(platform) ORDER BY bucket`;
      } else {
        sql = `SELECT date_trunc($1, created_at)::date AS bucket, priority AS breakdown, COUNT(*)::int AS count
               FROM sm_alert WHERE created_at >= $2::date AND created_at < ($3::date + 1)
               GROUP BY bucket, priority ORDER BY bucket`;
      }

      const result = await query(sql, [truncUnit, dateFrom, dateTo]);
      return { trends: result.rows };
    } catch (err: unknown) {
      request.log.error(err, "Failed to fetch trends");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // GET /api/v1/dashboard/pendency — Stage-wise aging analysis
  app.get("/api/v1/dashboard/pendency", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          entityType: { type: "string", enum: ["alerts", "cases"], default: "alerts" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const entityType = (request.query as Record<string, string | undefined>).entityType || "alerts";
      const table = entityType === "cases" ? "case_record" : "sm_alert";
      const closedStates = entityType === "cases"
        ? "('CLOSED','ARCHIVED')"
        : "('CLOSED_NO_ACTION','CLOSED_ACTIONED','FALSE_POSITIVE')";

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
         WHERE state_id NOT IN ${closedStates}
         GROUP BY state_id
         ORDER BY count DESC`,
      );

      return { stages: result.rows, entityType };
    } catch (err: unknown) {
      request.log.error(err, "Failed to fetch pendency");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // GET /api/v1/dashboard/geo — Geographic distribution
  app.get("/api/v1/dashboard/geo", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          dateFrom: { type: "string", format: "date" },
          dateTo: { type: "string", format: "date" },
          category: { type: "string", maxLength: 200 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const qs = request.query as Record<string, string | undefined>;
      const dateFrom = qs.dateFrom || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

      const result = await query(
        `SELECT ou.name AS district, ou.unit_id,
           COUNT(DISTINCT a.alert_id)::int AS alert_count,
           COUNT(DISTINCT c.case_id)::int AS case_count,
           AVG(ci.threat_score)::float AS avg_threat_score,
           COUNT(DISTINCT a.alert_id) FILTER (WHERE a.due_at < NOW() AND a.state_id NOT IN ('CLOSED_NO_ACTION','CLOSED_ACTIONED','FALSE_POSITIVE'))::int AS breach_count
         FROM organization_unit ou
         LEFT JOIN sm_alert a ON a.unit_id = ou.unit_id AND a.created_at >= $1::date
         LEFT JOIN case_record c ON c.unit_id = ou.unit_id AND c.created_at >= $1::date
         LEFT JOIN content_item ci ON ci.content_id = a.content_id
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

  // GET /api/v1/dashboard/heatmap — Category × District matrix
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
    try {
      const qs = request.query as Record<string, string | undefined>;
      const dateFrom = qs.dateFrom || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

      const result = await query(
        `SELECT ou.name AS district, COALESCE(tc.name, 'Uncategorized') AS category, COUNT(*)::int AS count
         FROM sm_alert a
         JOIN organization_unit ou ON ou.unit_id = a.unit_id
         LEFT JOIN taxonomy_category tc ON tc.category_id = a.category_id
         WHERE a.created_at >= $1::date AND ou.is_active = TRUE
         GROUP BY ou.name, tc.name
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
