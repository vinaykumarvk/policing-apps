import { FastifyInstance } from "fastify";
import { query } from "../db";
import { sendError, send404 } from "../errors";
import { executeTransition } from "../workflow-bridge";
import { getAvailableTransitions } from "../workflow-bridge/transitions";

export async function registerCaseRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/cases", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          state_id: { type: "string", maxLength: 100 },
          priority: { type: "string", maxLength: 50 },
          limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
          offset: { type: "integer", minimum: 0, default: 0 },
        },
      },
    },
  }, async (request) => {
    const { state_id, priority, limit: rawLimit, offset: rawOffset } = request.query as Record<string, string | undefined>;
    const unitId = request.authUser?.unitId || null;
    const limit = Math.min(Math.max(parseInt(rawLimit || "50", 10) || 50, 1), 200);
    const offset = Math.max(parseInt(rawOffset || "0", 10) || 0, 0);
    const result = await query(
      `SELECT case_id, case_ref, case_number, title, priority, state_id,
              source_alert_id, assigned_to, created_by, created_at,
              COUNT(*) OVER() AS total_count
       FROM case_record
       WHERE ($1::text IS NULL OR state_id = $1)
         AND ($2::text IS NULL OR priority = $2)
         AND ($3::uuid IS NULL OR unit_id = $3::uuid)
       ORDER BY created_at DESC
       LIMIT $4 OFFSET $5`,
      [state_id || null, priority || null, unitId, limit, offset],
    );
    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
    return { cases: result.rows.map(({ total_count, ...r }) => r), total };
  });

  app.get("/api/v1/cases/facets", async (request) => {
    const unitId = request.authUser?.unitId || null;
    const [stateRows, priorityRows] = await Promise.all([
      query(`SELECT state_id AS value, COUNT(*)::int AS count FROM case_record WHERE ($1::uuid IS NULL OR unit_id = $1::uuid) GROUP BY state_id ORDER BY count DESC`, [unitId]),
      query(`SELECT priority AS value, COUNT(*)::int AS count FROM case_record WHERE ($1::uuid IS NULL OR unit_id = $1::uuid) GROUP BY priority ORDER BY count DESC`, [unitId]),
    ]);
    return { facets: { state_id: stateRows.rows, priority: priorityRows.rows } };
  });

  app.post("/api/v1/cases", {
    schema: { body: { type: "object", additionalProperties: false, required: ["title"], properties: { title: { type: "string" }, description: { type: "string" }, alertId: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    const { title, description, alertId } = request.body as { title: string; description?: string; alertId?: string };
    const { userId } = request.authUser!;
    const unitId = request.authUser?.unitId || null;
    const refResult = await query(`SELECT 'TEF-CASE-' || EXTRACT(YEAR FROM NOW())::text || '-' || LPAD(nextval('sm_case_ref_seq')::text, 6, '0') AS ref`);
    const caseRef = refResult.rows[0].ref;
    const result = await query(
      `INSERT INTO case_record (title, description, source_alert_id, created_by, unit_id, case_ref) VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING case_id, case_number, case_ref, title, description, priority, state_id, source_alert_id, created_by, created_at`,
      [title, description || null, alertId || null, userId, unitId, caseRef],
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
      `SELECT case_id, case_ref, case_number, title, description, priority, state_id, row_version,
              source_alert_id, assigned_to, created_by, created_at, updated_at
       FROM case_record WHERE case_id = $1 AND ($2::uuid IS NULL OR unit_id = $2::uuid)`,
      [id, unitId],
    );
    if (result.rows.length === 0) {
      return send404(reply, "CASE_NOT_FOUND", "Case not found");
    }
    return { case: result.rows[0] };
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
      body: { type: "object", additionalProperties: false, required: ["transitionId"], properties: { transitionId: { type: "string" }, remarks: { type: "string" } } },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { transitionId, remarks } = request.body as { transitionId: string; remarks?: string };
    const { userId, roles } = request.authUser!;

    // Validate transition is allowed from current state
    const stateResult = await query(`SELECT state_id FROM case_record WHERE case_id = $1`, [id]);
    if (stateResult.rows.length === 0) return send404(reply, "CASE_NOT_FOUND", "Case not found");
    const available = getAvailableTransitions("sm_case", stateResult.rows[0].state_id);
    if (!available.some((t) => t.transitionId === transitionId)) {
      return sendError(reply, 400, "INVALID_TRANSITION", "Transition not allowed from current state");
    }

    const result = await executeTransition(
      id, "sm_case", transitionId, userId, "OFFICER", roles, remarks,
    );
    if (!result.success) {
      return sendError(reply, 409, result.error || "TRANSITION_FAILED", "Case transition failed");
    }
    return { success: true, newStateId: result.newStateId };
  });
}
