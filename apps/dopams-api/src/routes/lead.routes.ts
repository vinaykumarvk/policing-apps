import { FastifyInstance } from "fastify";
import { query } from "../db";
import { sendError, send404 } from "../errors";
import { executeTransition } from "../workflow-bridge";
import { getAvailableTransitions } from "../workflow-bridge/transitions";

export async function registerLeadRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/leads", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          state_id: { type: "string", maxLength: 100 },
          priority: { type: "string", maxLength: 50 },
          source_type: { type: "string", maxLength: 100 },
          limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
          offset: { type: "integer", minimum: 0, default: 0 },
        },
      },
    },
  }, async (request) => {
    const { state_id, priority, source_type, limit: rawLimit, offset: rawOffset } = request.query as Record<string, string | undefined>;
    const unitId = request.authUser?.unitId || null;
    const limit = Math.min(Math.max(parseInt(rawLimit || "50", 10) || 50, 1), 200);
    const offset = Math.max(parseInt(rawOffset || "0", 10) || 0, 0);

    const result = await query(
      `SELECT lead_id, lead_ref, source_type, summary, priority, state_id, subject_id,
              assigned_to, created_by, created_at,
              COUNT(*) OVER() AS total_count
       FROM lead
       WHERE ($1::text IS NULL OR state_id = $1)
         AND ($2::text IS NULL OR priority = $2)
         AND ($3::text IS NULL OR source_type = $3)
         AND ($4::uuid IS NULL OR unit_id = $4::uuid)
       ORDER BY created_at DESC
       LIMIT $5 OFFSET $6`,
      [state_id || null, priority || null, source_type || null, unitId, limit, offset],
    );
    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
    return { leads: result.rows.map(({ total_count, ...r }) => r), total };
  });

  app.get("/api/v1/leads/facets", async (request) => {
    const unitId = request.authUser?.unitId || null;
    const [stateRows, priorityRows, sourceRows] = await Promise.all([
      query(`SELECT state_id AS value, COUNT(*)::int AS count FROM lead WHERE ($1::uuid IS NULL OR unit_id = $1::uuid) GROUP BY state_id ORDER BY count DESC`, [unitId]),
      query(`SELECT priority AS value, COUNT(*)::int AS count FROM lead WHERE ($1::uuid IS NULL OR unit_id = $1::uuid) GROUP BY priority ORDER BY count DESC`, [unitId]),
      query(`SELECT source_type AS value, COUNT(*)::int AS count FROM lead WHERE ($1::uuid IS NULL OR unit_id = $1::uuid) GROUP BY source_type ORDER BY count DESC`, [unitId]),
    ]);
    return { facets: { state_id: stateRows.rows, priority: priorityRows.rows, source_type: sourceRows.rows } };
  });

  app.post("/api/v1/leads", {
    schema: { body: { type: "object", additionalProperties: false, required: ["sourceType", "summary"], properties: { sourceType: { type: "string" }, summary: { type: "string" }, details: { type: "string" } } } },
  }, async (request, reply) => {
    const { sourceType, summary, details } = request.body as { sourceType: string; summary: string; details?: string };
    const { userId } = request.authUser!;
    const unitId = request.authUser?.unitId || null;
    const refResult = await query(`SELECT 'DOP-LEAD-' || EXTRACT(YEAR FROM NOW())::text || '-' || LPAD(nextval('dopams_lead_ref_seq')::text, 6, '0') AS ref`);
    const leadRef = refResult.rows[0].ref;
    const result = await query(
      `INSERT INTO lead (lead_ref, source_type, summary, details, created_by, unit_id) VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING lead_id, lead_ref, source_type, summary, details, priority, state_id, unit_id, created_by, created_at`,
      [leadRef, sourceType, summary, details || null, userId, unitId],
    );
    reply.code(201);
    return { lead: result.rows[0] };
  });

  app.get("/api/v1/leads/:id", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const unitId = request.authUser?.unitId || null;
    const result = await query(
      `SELECT lead_id, lead_ref, source_type, summary, details, priority, state_id, row_version,
              subject_id, assigned_to, created_by, created_at, updated_at
       FROM lead WHERE lead_id = $1 AND ($2::uuid IS NULL OR unit_id = $2::uuid)`,
      [id, unitId],
    );
    if (result.rows.length === 0) {
      return send404(reply, "LEAD_NOT_FOUND", "Lead not found");
    }
    return { lead: result.rows[0] };
  });

  app.post("/api/v1/leads/:id/transition", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: { type: "object", additionalProperties: false, required: ["transitionId"], properties: { transitionId: { type: "string" }, remarks: { type: "string" } } },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { transitionId, remarks } = request.body as { transitionId: string; remarks?: string };
    const { userId, roles } = request.authUser!;

    // Validate transition is allowed from current state
    const stateResult = await query(`SELECT state_id FROM lead WHERE lead_id = $1`, [id]);
    if (stateResult.rows.length === 0) return send404(reply, "LEAD_NOT_FOUND", "Lead not found");
    const available = getAvailableTransitions("dopams_lead", stateResult.rows[0].state_id);
    if (!available.some((t) => t.transitionId === transitionId)) {
      return sendError(reply, 400, "INVALID_TRANSITION", "Transition not allowed from current state");
    }

    const result = await executeTransition(
      id, "dopams_lead", transitionId, userId, "OFFICER", roles, remarks,
    );
    if (!result.success) {
      return sendError(reply, 409, result.error || "TRANSITION_FAILED", "Lead transition failed");
    }
    return { success: true, newStateId: result.newStateId };
  });

  app.get("/api/v1/leads/:id/transitions", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await query(`SELECT state_id FROM lead WHERE lead_id = $1`, [id]);
    if (result.rows.length === 0) return send404(reply, "LEAD_NOT_FOUND", "Lead not found");
    return { transitions: getAvailableTransitions("dopams_lead", result.rows[0].state_id) };
  });
}
