import { FastifyInstance } from "fastify";
import { query } from "../db";
import { send404, sendError } from "../errors";
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
      `SELECT case_id, case_number, title, case_type, priority, state_id,
              assigned_to, created_by, created_at,
              COUNT(*) OVER() AS total_count
       FROM dopams_case
       WHERE ($1::text IS NULL OR state_id = $1)
         AND ($2::text IS NULL OR priority = $2)
         AND (unit_id = $3::uuid)
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
      query(`SELECT state_id AS value, COUNT(*)::int AS count FROM dopams_case WHERE (unit_id = $1::uuid) GROUP BY state_id ORDER BY count DESC`, [unitId]),
      query(`SELECT priority AS value, COUNT(*)::int AS count FROM dopams_case WHERE (unit_id = $1::uuid) GROUP BY priority ORDER BY count DESC`, [unitId]),
    ]);
    return { facets: { state_id: stateRows.rows, priority: priorityRows.rows } };
  });

  app.get("/api/v1/cases/:id", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const unitId = request.authUser?.unitId || null;
    const result = await query(
      `SELECT case_id, case_number, title, description, case_type, priority, state_id, row_version,
              assigned_to, created_by, created_at, updated_at
       FROM dopams_case WHERE case_id = $1 AND (unit_id = $2::uuid)`,
      [id, unitId],
    );
    if (result.rows.length === 0) {
      return send404(reply, "CASE_NOT_FOUND", "Case not found");
    }
    return { case: result.rows[0] };
  });

  app.post("/api/v1/cases", {
    schema: { body: { type: "object", additionalProperties: false, required: ["title"], properties: { title: { type: "string" }, description: { type: "string" }, subjectIds: { type: "array", items: { type: "string", format: "uuid" } } } } },
  }, async (request, reply) => {
    const { title, description } = request.body as { title: string; description?: string; subjectIds?: string[] };
    const { userId } = request.authUser!;
    const unitId = request.authUser?.unitId || null;
    const refResult = await query(`SELECT 'DOP-CASE-' || EXTRACT(YEAR FROM NOW())::text || '-' || LPAD(nextval('dopams_case_ref_seq')::text, 6, '0') AS ref`);
    const caseNumber = refResult.rows[0].ref;
    const result = await query(
      `INSERT INTO dopams_case (case_number, title, description, created_by, unit_id) VALUES ($1, $2, $3, $4, $5)
       RETURNING case_id, case_number, title, description, case_type, priority, state_id, unit_id, created_by, created_at`,
      [caseNumber, title, description || null, userId, unitId],
    );
    reply.code(201);
    return { case: result.rows[0] };
  });

  app.get("/api/v1/cases/:id/transitions", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await query(`SELECT state_id FROM dopams_case WHERE case_id = $1`, [id]);
    if (result.rows.length === 0) return send404(reply, "CASE_NOT_FOUND", "Case not found");
    return { transitions: getAvailableTransitions("dopams_case", result.rows[0].state_id) };
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
    const stateResult = await query(`SELECT state_id FROM dopams_case WHERE case_id = $1`, [id]);
    if (stateResult.rows.length === 0) return send404(reply, "CASE_NOT_FOUND", "Case not found");
    const available = getAvailableTransitions("dopams_case", stateResult.rows[0].state_id);
    if (!available.some((t) => t.transitionId === transitionId)) {
      return sendError(reply, 400, "INVALID_TRANSITION", "Transition not allowed from current state");
    }

    const result = await executeTransition(
      id, "dopams_case", transitionId, userId, "OFFICER", roles, remarks,
    );
    if (!result.success) {
      return sendError(reply, 409, result.error || "TRANSITION_FAILED", "Case transition failed");
    }
    return { success: true, newStateId: result.newStateId };
  });
}
