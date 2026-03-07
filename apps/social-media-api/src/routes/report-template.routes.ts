import { FastifyInstance } from "fastify";
import { query } from "../db";
import { sendError, send400, send404 } from "../errors";

export async function registerReportTemplateRoutes(app: FastifyInstance): Promise<void> {
  // ── Report Template CRUD ──

  // GET /api/v1/report-templates — List templates
  app.get("/api/v1/report-templates", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          templateType: { type: "string", maxLength: 64 },
          limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
          offset: { type: "integer", minimum: 0, default: 0 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { templateType, limit: rawLimit, offset: rawOffset } = request.query as Record<string, string | undefined>;
      const limit = Math.min(parseInt(rawLimit || "50", 10) || 50, 200);
      const offset = Math.max(parseInt(rawOffset || "0", 10) || 0, 0);
      const result = await query(
        `SELECT template_id, name, template_type, content_schema, content_jsonb, is_active,
                created_by, created_at, updated_at,
                COUNT(*) OVER() AS total_count
         FROM report_template
         WHERE deleted_at IS NULL
           AND ($1::text IS NULL OR template_type = $1)
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [templateType || null, limit, offset],
      );
      const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
      return { templates: result.rows.map(({ total_count, ...r }: any) => r), total };
    } catch (err: unknown) {
      request.log.error(err, "Failed to list report templates");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // POST /api/v1/report-templates — Create template
  app.post("/api/v1/report-templates", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["name", "templateType"],
        properties: {
          name: { type: "string", maxLength: 128 },
          templateType: { type: "string", maxLength: 64 },
          contentSchema: { type: "object" },
          contentJsonb: { type: "object" },
          isActive: { type: "boolean" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { name, templateType, contentSchema, contentJsonb, isActive } = request.body as {
        name: string; templateType: string; contentSchema?: Record<string, unknown>;
        contentJsonb?: Record<string, unknown>; isActive?: boolean;
      };
      const { userId } = request.authUser!;
      const result = await query(
        `INSERT INTO report_template (name, template_type, content_schema, content_jsonb, is_active, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING template_id, name, template_type, content_schema, content_jsonb, is_active, created_by, created_at`,
        [name, templateType, JSON.stringify(contentSchema || {}), JSON.stringify(contentJsonb || {}), isActive !== false, userId],
      );
      reply.code(201);
      return { template: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to create report template");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // PATCH /api/v1/report-templates/:id — Update template
  app.patch("/api/v1/report-templates/:id", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string", maxLength: 128 },
          templateType: { type: "string", maxLength: 64 },
          contentSchema: { type: "object" },
          contentJsonb: { type: "object" },
          isActive: { type: "boolean" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { name, templateType, contentSchema, contentJsonb, isActive } = request.body as {
        name?: string; templateType?: string; contentSchema?: Record<string, unknown>;
        contentJsonb?: Record<string, unknown>; isActive?: boolean;
      };

      const sets: string[] = [];
      const params: any[] = [];
      let idx = 1;

      if (name !== undefined) { sets.push(`name = $${idx++}`); params.push(name); }
      if (templateType !== undefined) { sets.push(`template_type = $${idx++}`); params.push(templateType); }
      if (contentSchema !== undefined) { sets.push(`content_schema = $${idx++}`); params.push(JSON.stringify(contentSchema)); }
      if (contentJsonb !== undefined) { sets.push(`content_jsonb = $${idx++}`); params.push(JSON.stringify(contentJsonb)); }
      if (isActive !== undefined) { sets.push(`is_active = $${idx++}`); params.push(isActive); }

      if (sets.length === 0) {
        return send400(reply, "NO_FIELDS", "No fields to update");
      }

      sets.push(`updated_at = NOW()`);
      params.push(id);

      const result = await query(
        `UPDATE report_template SET ${sets.join(", ")} WHERE template_id = $${idx} AND deleted_at IS NULL
         RETURNING template_id, name, template_type, content_schema, content_jsonb, is_active, updated_at`,
        params,
      );
      if (result.rows.length === 0) {
        return send404(reply, "TEMPLATE_NOT_FOUND", "Report template not found");
      }
      return { template: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to update report template");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // DELETE /api/v1/report-templates/:id — Soft delete
  app.delete("/api/v1/report-templates/:id", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const result = await query(
        `UPDATE report_template SET deleted_at = NOW(), is_active = FALSE, updated_at = NOW()
         WHERE template_id = $1 AND deleted_at IS NULL
         RETURNING template_id`,
        [id],
      );
      if (result.rows.length === 0) {
        return send404(reply, "TEMPLATE_NOT_FOUND", "Report template not found");
      }
      return { success: true };
    } catch (err: unknown) {
      request.log.error(err, "Failed to delete report template");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // ── 6 Named MIS Queries (FR-13) ──

  // 1. Platform Summary — Content by platform
  app.get("/api/v1/reports/mis/platform-summary", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          from: { type: "string", format: "date" },
          to: { type: "string", format: "date" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { from, to } = request.query as { from?: string; to?: string };
      const result = await query(
        `SELECT platform,
                COUNT(*)::int AS total_content,
                COUNT(DISTINCT author_handle)::int AS unique_authors,
                AVG(threat_score)::numeric(5,2) AS avg_threat_score,
                COUNT(*) FILTER (WHERE threat_score > 50)::int AS high_threat_count
         FROM content_item
         WHERE ($1::date IS NULL OR ingested_at >= $1::date)
           AND ($2::date IS NULL OR ingested_at <= ($2::date + INTERVAL '1 day'))
         GROUP BY platform
         ORDER BY total_content DESC`,
        [from || null, to || null],
      );
      return { summary: result.rows, generatedAt: new Date().toISOString() };
    } catch (err: unknown) {
      request.log.error(err, "Failed to generate platform summary");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // 2. Risk Distribution — Alerts by risk level
  app.get("/api/v1/reports/mis/risk-distribution", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          from: { type: "string", format: "date" },
          to: { type: "string", format: "date" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { from, to } = request.query as { from?: string; to?: string };
      const result = await query(
        `SELECT a.priority,
                a.priority_queue,
                COUNT(*)::int AS alert_count,
                COUNT(*) FILTER (WHERE a.state_id = 'NEW')::int AS new_count,
                COUNT(*) FILTER (WHERE a.state_id = 'ACKNOWLEDGED')::int AS acknowledged_count,
                COUNT(*) FILTER (WHERE a.state_id = 'ESCALATED')::int AS escalated_count,
                COUNT(*) FILTER (WHERE a.state_id = 'DISMISSED')::int AS dismissed_count,
                COUNT(*) FILTER (WHERE a.state_id = 'FALSE_POSITIVE')::int AS false_positive_count
         FROM sm_alert a
         WHERE ($1::date IS NULL OR a.created_at >= $1::date)
           AND ($2::date IS NULL OR a.created_at <= ($2::date + INTERVAL '1 day'))
         GROUP BY a.priority, a.priority_queue
         ORDER BY CASE a.priority WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END`,
        [from || null, to || null],
      );
      return { distribution: result.rows, generatedAt: new Date().toISOString() };
    } catch (err: unknown) {
      request.log.error(err, "Failed to generate risk distribution");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // 3. Response Time — SLA compliance metrics
  app.get("/api/v1/reports/mis/response-time", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          from: { type: "string", format: "date" },
          to: { type: "string", format: "date" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { from, to } = request.query as { from?: string; to?: string };
      const result = await query(
        `SELECT
           COUNT(*)::int AS total_tasks,
           COUNT(*) FILTER (WHERE ct.status = 'COMPLETED')::int AS completed_tasks,
           COUNT(*) FILTER (WHERE ct.status = 'COMPLETED' AND ct.completed_at <= ct.sla_due_at)::int AS within_sla,
           COUNT(*) FILTER (WHERE ct.status = 'COMPLETED' AND ct.completed_at > ct.sla_due_at)::int AS breached_sla,
           COUNT(*) FILTER (WHERE ct.status = 'PENDING' AND ct.sla_due_at < NOW())::int AS overdue_pending,
           ROUND(AVG(EXTRACT(EPOCH FROM (ct.completed_at - ct.created_at)) / 3600)::numeric, 2) AS avg_completion_hours,
           ROUND(
             (COUNT(*) FILTER (WHERE ct.status = 'COMPLETED' AND ct.completed_at <= ct.sla_due_at)::numeric /
              NULLIF(COUNT(*) FILTER (WHERE ct.status = 'COMPLETED')::numeric, 0)) * 100, 2
           ) AS sla_compliance_pct
         FROM case_task ct
         WHERE ($1::date IS NULL OR ct.created_at >= $1::date)
           AND ($2::date IS NULL OR ct.created_at <= ($2::date + INTERVAL '1 day'))`,
        [from || null, to || null],
      );
      return { metrics: result.rows[0], generatedAt: new Date().toISOString() };
    } catch (err: unknown) {
      request.log.error(err, "Failed to generate response time metrics");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // 4. Category Trends — Category trends over time
  app.get("/api/v1/reports/mis/category-trends", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          from: { type: "string", format: "date" },
          to: { type: "string", format: "date" },
          interval: { type: "string", enum: ["day", "week", "month"], default: "week" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { from, to, interval: intv } = request.query as { from?: string; to?: string; interval?: string };
      const truncInterval = intv === "day" ? "day" : intv === "month" ? "month" : "week";
      const result = await query(
        `SELECT DATE_TRUNC($3, a.created_at) AS period,
                a.alert_type AS category,
                COUNT(*)::int AS alert_count
         FROM sm_alert a
         WHERE ($1::date IS NULL OR a.created_at >= $1::date)
           AND ($2::date IS NULL OR a.created_at <= ($2::date + INTERVAL '1 day'))
         GROUP BY period, a.alert_type
         ORDER BY period DESC, alert_count DESC`,
        [from || null, to || null, truncInterval],
      );
      return { trends: result.rows, interval: truncInterval, generatedAt: new Date().toISOString() };
    } catch (err: unknown) {
      request.log.error(err, "Failed to generate category trends");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // 5. Analyst Workload — Cases per analyst
  app.get("/api/v1/reports/mis/analyst-workload", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          from: { type: "string", format: "date" },
          to: { type: "string", format: "date" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { from, to } = request.query as { from?: string; to?: string };
      const result = await query(
        `SELECT u.user_id, u.full_name, u.username,
                COUNT(DISTINCT c.case_id)::int AS assigned_cases,
                COUNT(DISTINCT c.case_id) FILTER (WHERE c.state_id = 'OPEN')::int AS open_cases,
                COUNT(DISTINCT c.case_id) FILTER (WHERE c.state_id = 'CLOSED')::int AS closed_cases,
                COUNT(DISTINCT a.alert_id)::int AS assigned_alerts,
                COUNT(DISTINCT ct.task_id)::int AS pending_tasks,
                COUNT(DISTINCT ct.task_id) FILTER (WHERE ct.status = 'PENDING' AND ct.sla_due_at < NOW())::int AS overdue_tasks
         FROM user_account u
         LEFT JOIN case_record c ON c.assigned_to = u.user_id
           AND ($1::date IS NULL OR c.created_at >= $1::date)
           AND ($2::date IS NULL OR c.created_at <= ($2::date + INTERVAL '1 day'))
         LEFT JOIN sm_alert a ON a.assigned_to = u.user_id
           AND ($1::date IS NULL OR a.created_at >= $1::date)
           AND ($2::date IS NULL OR a.created_at <= ($2::date + INTERVAL '1 day'))
         LEFT JOIN case_task ct ON ct.assignee_user_id = u.user_id AND ct.status = 'PENDING'
         WHERE u.is_active = TRUE
         GROUP BY u.user_id, u.full_name, u.username
         HAVING COUNT(DISTINCT c.case_id) > 0 OR COUNT(DISTINCT a.alert_id) > 0
         ORDER BY assigned_cases DESC`,
        [from || null, to || null],
      );
      return { analysts: result.rows, generatedAt: new Date().toISOString() };
    } catch (err: unknown) {
      request.log.error(err, "Failed to generate analyst workload");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // 6. Escalation Funnel — Escalation metrics
  app.get("/api/v1/reports/mis/escalation-funnel", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          from: { type: "string", format: "date" },
          to: { type: "string", format: "date" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { from, to } = request.query as { from?: string; to?: string };
      const result = await query(
        `SELECT
           COUNT(*)::int AS total_alerts,
           COUNT(*) FILTER (WHERE state_id = 'NEW')::int AS stage_new,
           COUNT(*) FILTER (WHERE state_id = 'ACKNOWLEDGED')::int AS stage_acknowledged,
           COUNT(*) FILTER (WHERE state_id = 'ESCALATED')::int AS stage_escalated,
           COUNT(*) FILTER (WHERE state_id = 'DISMISSED')::int AS stage_dismissed,
           COUNT(*) FILTER (WHERE state_id = 'FALSE_POSITIVE')::int AS stage_false_positive,
           ROUND(
             (COUNT(*) FILTER (WHERE state_id = 'ESCALATED')::numeric /
              NULLIF(COUNT(*)::numeric, 0)) * 100, 2
           ) AS escalation_rate_pct,
           ROUND(
             (COUNT(*) FILTER (WHERE state_id = 'FALSE_POSITIVE')::numeric /
              NULLIF(COUNT(*)::numeric, 0)) * 100, 2
           ) AS false_positive_rate_pct
         FROM sm_alert
         WHERE ($1::date IS NULL OR created_at >= $1::date)
           AND ($2::date IS NULL OR created_at <= ($2::date + INTERVAL '1 day'))`,
        [from || null, to || null],
      );

      // Also get escalation by alert type
      const byTypeResult = await query(
        `SELECT alert_type,
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE state_id = 'ESCALATED')::int AS escalated,
                ROUND(
                  (COUNT(*) FILTER (WHERE state_id = 'ESCALATED')::numeric /
                   NULLIF(COUNT(*)::numeric, 0)) * 100, 2
                ) AS escalation_rate_pct
         FROM sm_alert
         WHERE ($1::date IS NULL OR created_at >= $1::date)
           AND ($2::date IS NULL OR created_at <= ($2::date + INTERVAL '1 day'))
         GROUP BY alert_type
         ORDER BY escalated DESC`,
        [from || null, to || null],
      );

      return {
        funnel: result.rows[0],
        byAlertType: byTypeResult.rows,
        generatedAt: new Date().toISOString(),
      };
    } catch (err: unknown) {
      request.log.error(err, "Failed to generate escalation funnel");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });
}
