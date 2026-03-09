import { FastifyInstance } from "fastify";
import { query } from "../db";
import { sendError, send400, send403, send404 } from "../errors";
import { createRoleGuard } from "@puda/api-core";
import { executeTransition } from "../workflow-bridge";
import { getAvailableTransitions } from "../workflow-bridge/transitions";

const requireAnalyst = createRoleGuard(["ANALYST", "SUPERVISOR", "PLATFORM_ADMINISTRATOR"]);
const requireSupervisor = createRoleGuard(["SUPERVISOR", "PLATFORM_ADMINISTRATOR"]);

export async function registerCaseRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/cases", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          state_id: { type: "string", maxLength: 100 },
          priority: { type: "string", maxLength: 50 },
          category: { type: "string", maxLength: 100 },
          limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
          offset: { type: "integer", minimum: 0, default: 0 },
        },
      },
    },
  }, async (request) => {
    const { state_id, priority, category, limit: rawLimit, offset: rawOffset } = request.query as Record<string, string | undefined>;
    const unitId = request.authUser?.unitId || null;
    const limit = Math.min(Math.max(parseInt(rawLimit || "50", 10) || 50, 1), 200);
    const offset = Math.max(parseInt(rawOffset || "0", 10) || 0, 0);
    const result = await query(
      `SELECT c.case_id, c.case_ref, c.case_number, c.title, c.priority, c.state_id,
              c.source_alert_id, c.assigned_to, c.due_at, c.closed_at, c.created_by, c.created_at,
              u.full_name AS assigned_to_name, u.designation AS assigned_to_designation,
              tc.name AS category_name,
              COUNT(*) OVER() AS total_count
       FROM case_record c
       LEFT JOIN user_account u ON u.user_id = c.assigned_to
       LEFT JOIN sm_alert a ON a.alert_id = c.source_alert_id
       LEFT JOIN taxonomy_category tc ON tc.category_id = a.category_id
       WHERE ($1::text IS NULL OR c.state_id = $1)
         AND ($2::text IS NULL OR c.priority = $2)
         AND ($6::text IS NULL OR tc.name = $6)
         AND (c.unit_id = $3::uuid OR c.unit_id IN (SELECT unit_id FROM organization_unit WHERE parent_unit_id = $3::uuid))
       ORDER BY c.created_at DESC
       LIMIT $4 OFFSET $5`,
      [state_id || null, priority || null, unitId, limit, offset, category || null],
    );
    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
    return { cases: result.rows.map(({ total_count, ...r }) => r), total };
  });

  app.get("/api/v1/cases/facets", async (request) => {
    const unitId = request.authUser?.unitId || null;
    const unitClause = `(unit_id = $1::uuid OR unit_id IN (SELECT unit_id FROM organization_unit WHERE parent_unit_id = $1::uuid))`;
    const [stateRows, priorityRows, categoryRows] = await Promise.all([
      query(`SELECT state_id AS value, COUNT(*)::int AS count FROM case_record WHERE ${unitClause} GROUP BY state_id ORDER BY count DESC`, [unitId]),
      query(`SELECT priority AS value, COUNT(*)::int AS count FROM case_record WHERE ${unitClause} GROUP BY priority ORDER BY count DESC`, [unitId]),
      query(
        `SELECT tc.name AS value, COUNT(*)::int AS count
         FROM case_record c
         JOIN sm_alert a ON a.alert_id = c.source_alert_id
         JOIN taxonomy_category tc ON tc.category_id = a.category_id
         WHERE ${unitClause.replace(/unit_id/g, 'c.unit_id')}
         GROUP BY tc.name ORDER BY count DESC`,
        [unitId],
      ),
    ]);
    return { facets: { state_id: stateRows.rows, priority: priorityRows.rows, category: categoryRows.rows } };
  });

  app.post("/api/v1/cases", {
    schema: { body: { type: "object", additionalProperties: false, required: ["title"], properties: {
      title: { type: "string" }, description: { type: "string" }, alertId: { type: "string", format: "uuid" },
      dueAt: { type: "string", format: "date-time" }, closureReason: { type: "string" },
    } } },
  }, async (request, reply) => {
    if (!requireAnalyst(request, reply)) return;
    const { title, description, alertId, dueAt } = request.body as { title: string; description?: string; alertId?: string; dueAt?: string };
    const { userId } = request.authUser!;
    const unitId = request.authUser?.unitId || null;
    const refResult = await query(`SELECT 'TEF-CASE-' || EXTRACT(YEAR FROM NOW())::text || '-' || LPAD(nextval('sm_case_ref_seq')::text, 6, '0') AS ref`);
    const caseRef = refResult.rows[0].ref;
    const result = await query(
      `INSERT INTO case_record (title, description, source_alert_id, created_by, unit_id, case_ref, due_at) VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING case_id, case_number, case_ref, title, description, priority, state_id, source_alert_id, due_at, created_by, created_at`,
      [title, description || null, alertId || null, userId, unitId, caseRef, dueAt || null],
    );
    reply.code(201);
    return { case: result.rows[0] };
  });

  app.get("/api/v1/cases/:id", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const unitId = request.authUser?.unitId || null;
    const result = await query(
      `SELECT c.case_id, c.case_ref, c.case_number, c.title, c.description, c.priority, c.state_id, c.row_version,
              c.source_alert_id, c.assigned_to, c.due_at, c.closure_reason, c.closed_at,
              c.created_by, c.created_at, c.updated_at,
              ua.full_name AS assigned_to_name, ua.designation AS assigned_to_designation,
              uc.full_name AS created_by_name,
              a.alert_ref AS source_alert_ref, a.title AS source_alert_title,
              a.priority AS source_alert_priority, a.state_id AS source_alert_state,
              a.content_id AS source_content_id
       FROM case_record c
       LEFT JOIN user_account ua ON ua.user_id = c.assigned_to
       LEFT JOIN user_account uc ON uc.user_id = c.created_by
       LEFT JOIN sm_alert a ON a.alert_id = c.source_alert_id
       WHERE c.case_id = $1
         AND (c.unit_id IS NULL OR c.unit_id = $2::uuid OR c.unit_id IN (SELECT unit_id FROM organization_unit WHERE parent_unit_id = $2::uuid))`,
      [id, unitId],
    );
    if (result.rows.length === 0) {
      return send404(reply, "CASE_NOT_FOUND", "Case not found");
    }
    return { case: result.rows[0] };
  });

  // Linked social media posts for a case (via source alert + evidence items)
  app.get("/api/v1/cases/:id/linked-posts", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const caseCheck = await query(`SELECT case_id FROM case_record WHERE case_id = $1`, [id]);
    if (caseCheck.rows.length === 0) return send404(reply, "CASE_NOT_FOUND", "Case not found");

    const result = await query(
      `SELECT ci.content_id, ci.platform, ci.author_handle, ci.author_name,
              ci.content_text, ci.content_url, ci.language, ci.threat_score,
              ci.published_at, ci.sentiment,
              cr.category AS classification_category, cr.risk_score AS classification_score
       FROM content_item ci
       LEFT JOIN classification_result cr ON cr.entity_type = 'content_item' AND cr.entity_id = ci.content_id
       WHERE ci.content_id IN (
         SELECT a.content_id FROM sm_alert a
         WHERE a.alert_id = (SELECT source_alert_id FROM case_record WHERE case_id = $1)
           AND a.content_id IS NOT NULL
         UNION
         SELECT e.content_id FROM evidence_item e WHERE e.case_id = $1 AND e.content_id IS NOT NULL
       )
       ORDER BY ci.published_at DESC`,
      [id],
    );
    return { posts: result.rows };
  });

  // GET /api/v1/cases/assignable-officers — Officers available for case assignment
  app.get("/api/v1/cases/assignable-officers", async (request) => {
    const unitId = request.authUser?.unitId || null;
    const result = await query(
      `SELECT DISTINCT u.user_id, u.full_name, u.designation, u.username
       FROM user_account u
       JOIN user_role ur ON ur.user_id = u.user_id
       JOIN role r ON r.role_id = ur.role_id
       WHERE u.is_active = TRUE AND u.unit_id = $1::uuid
         AND r.role_key IN ('INVESTIGATOR','SUPERVISOR','INTELLIGENCE_ANALYST')
       ORDER BY u.full_name`,
      [unitId],
    );
    return { officers: result.rows };
  });

  app.get("/api/v1/cases/:id/transitions", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await query(`SELECT state_id FROM case_record WHERE case_id = $1`, [id]);
    if (result.rows.length === 0) return send404(reply, "CASE_NOT_FOUND", "Case not found");
    return { transitions: getAvailableTransitions("sm_case", result.rows[0].state_id) };
  });

  app.post("/api/v1/cases/:id/transition", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: { type: "object", additionalProperties: false, required: ["transitionId"], properties: { transitionId: { type: "string" }, remarks: { type: "string" }, assignedTo: { type: "string", format: "uuid" } } },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { transitionId, remarks, assignedTo } = request.body as { transitionId: string; remarks?: string; assignedTo?: string };
    const { userId, roles } = request.authUser!;

    const result = await executeTransition(
      id, "sm_case", transitionId, userId, "OFFICER", roles, remarks,
    );
    if (!result.success) {
      if (result.error === "ENTITY_NOT_FOUND") return send404(reply, "CASE_NOT_FOUND", "Case not found");
      return sendError(reply, 409, result.error || "TRANSITION_FAILED", "Case transition failed");
    }

    // Set assigned_to when ASSIGN transition includes an officer
    if (transitionId === "ASSIGN" && assignedTo) {
      await query(
        `UPDATE case_record SET assigned_to = $1, updated_at = NOW() WHERE case_id = $2`,
        [assignedTo, id],
      );
    }

    // Auto-set closed_at when case transitions to a CLOSED state
    if (result.newStateId === "CLOSED") {
      await query(
        `UPDATE case_record SET closed_at = NOW(), closure_reason = $1 WHERE case_id = $2`,
        [remarks || "Closed via workflow transition", id],
      );
    }

    return { success: true, newStateId: result.newStateId };
  });

  // FR-12: GET /api/v1/cases/:id/timeline — Aggregated timeline of all events
  app.get("/api/v1/cases/:id/timeline", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 500, default: 100 },
          offset: { type: "integer", minimum: 0, default: 0 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { limit: rawLimit, offset: rawOffset } = request.query as Record<string, string | undefined>;
      const limit = Math.min(parseInt(rawLimit || "100", 10) || 100, 500);
      const offset = Math.max(parseInt(rawOffset || "0", 10) || 0, 0);

      // Verify case exists
      const caseCheck = await query(`SELECT case_id FROM case_record WHERE case_id = $1`, [id]);
      if (caseCheck.rows.length === 0) {
        return send404(reply, "CASE_NOT_FOUND", "Case not found");
      }

      // Aggregate timeline from multiple sources
      const timelineResult = await query(
        `SELECT * FROM (
           -- State change events from audit log
           SELECT 'STATE_CHANGE' AS event_type, al.audit_id AS event_id,
                  al.from_state, al.to_state, al.transition_id, al.remarks AS detail,
                  al.actor_id, u1.full_name AS actor_name, al.created_at
           FROM audit_log al
           LEFT JOIN user_account u1 ON u1.user_id = al.actor_id
           WHERE al.entity_type = 'sm_case' AND al.entity_id = $1

           UNION ALL

           -- Notes added to the case
           SELECT 'NOTE' AS event_type, n.note_id AS event_id,
                  NULL AS from_state, NULL AS to_state, NULL AS transition_id, n.note_text AS detail,
                  n.created_by AS actor_id, u2.full_name AS actor_name, n.created_at
           FROM entity_note n
           LEFT JOIN user_account u2 ON u2.user_id = n.created_by
           WHERE n.entity_type = 'sm_case' AND n.entity_id = $1

           UNION ALL

           -- Evidence linked to the case
           SELECT 'EVIDENCE_ADDED' AS event_type, e.evidence_id AS event_id,
                  NULL AS from_state, e.state_id AS to_state, NULL AS transition_id,
                  COALESCE(e.evidence_ref, e.evidence_id::text) AS detail,
                  e.captured_by AS actor_id, u3.full_name AS actor_name, e.created_at
           FROM evidence_item e
           LEFT JOIN user_account u3 ON u3.user_id = e.captured_by
           WHERE e.case_id = $1

           UNION ALL

           -- Alerts linked to the case
           SELECT 'ALERT_LINKED' AS event_type, a.alert_id AS event_id,
                  NULL AS from_state, a.state_id AS to_state, NULL AS transition_id,
                  COALESCE(a.alert_ref, a.title) AS detail,
                  NULL AS actor_id, NULL AS actor_name, a.created_at
           FROM sm_alert a
           WHERE a.alert_id = (SELECT source_alert_id FROM case_record WHERE case_id = $1)

           UNION ALL

           -- Reports generated for the case
           SELECT 'REPORT_CREATED' AS event_type, r.report_id AS event_id,
                  NULL AS from_state, r.state_id AS to_state, NULL AS transition_id,
                  COALESCE(r.report_ref, r.title) AS detail,
                  r.created_by AS actor_id, u4.full_name AS actor_name, r.created_at
           FROM report_instance r
           LEFT JOIN user_account u4 ON u4.user_id = r.created_by
           WHERE r.case_id = $1
         ) timeline
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [id, limit, offset],
      );

      return { caseId: id, timeline: timelineResult.rows, count: timelineResult.rows.length };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get case timeline");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // FR-12: POST /api/v1/cases/:id/supervisor-close — Supervisor-only closure bypassing normal workflow
  app.post("/api/v1/cases/:id/supervisor-close", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: {
        type: "object",
        additionalProperties: false,
        required: ["justification"],
        properties: {
          justification: { type: "string", minLength: 10, maxLength: 5000 },
        },
      },
    },
  }, async (request, reply) => {
    if (!requireSupervisor(request, reply)) return;
    try {
      const { id } = request.params as { id: string };
      const { justification } = request.body as { justification: string };
      const { userId, roles } = request.authUser!;

      // Verify case exists
      const caseResult = await query(
        `SELECT case_id, state_id FROM case_record WHERE case_id = $1`,
        [id],
      );
      if (caseResult.rows.length === 0) {
        return send404(reply, "CASE_NOT_FOUND", "Case not found");
      }

      if (caseResult.rows[0].state_id === "CLOSED") {
        return send400(reply, "ALREADY_CLOSED", "Case is already closed");
      }

      const previousState = caseResult.rows[0].state_id;

      // Direct closure bypassing normal workflow
      await query(
        `UPDATE case_record SET state_id = 'CLOSED', closed_at = NOW(),
                closure_reason = $1, updated_at = NOW(), row_version = row_version + 1
         WHERE case_id = $2`,
        [`[SUPERVISOR CLOSURE] ${justification}`, id],
      );

      // Audit log entry for supervisor closure
      await query(
        `INSERT INTO audit_log (entity_type, entity_id, event_type, from_state, to_state, actor_type, actor_id, remarks)
         VALUES ('sm_case', $1, 'SUPERVISOR_CLOSE', $2, 'CLOSED', 'OFFICER', $3, $4)`,
        [id, previousState, userId, justification],
      );

      return { success: true, caseId: id, newStateId: "CLOSED", closedBy: userId, justification };
    } catch (err: unknown) {
      request.log.error(err, "Failed to perform supervisor closure");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });
}
