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
         AND (unit_id = $4::uuid)
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
      query(`SELECT state_id AS value, COUNT(*)::int AS count FROM lead WHERE (unit_id = $1::uuid) GROUP BY state_id ORDER BY count DESC`, [unitId]),
      query(`SELECT priority AS value, COUNT(*)::int AS count FROM lead WHERE (unit_id = $1::uuid) GROUP BY priority ORDER BY count DESC`, [unitId]),
      query(`SELECT source_type AS value, COUNT(*)::int AS count FROM lead WHERE (unit_id = $1::uuid) GROUP BY source_type ORDER BY count DESC`, [unitId]),
    ]);
    return { facets: { state_id: stateRows.rows, priority: priorityRows.rows, source_type: sourceRows.rows } };
  });

  app.post("/api/v1/leads", {
    schema: { body: { type: "object", additionalProperties: false, required: ["sourceType", "summary"], properties: {
      sourceType: { type: "string" }, summary: { type: "string" }, details: { type: "string" },
      channel: { type: "string" }, informantName: { type: "string" }, informantContact: { type: "string" },
      urgency: { type: "string", enum: ["LOW", "NORMAL", "HIGH", "CRITICAL"] },
      duplicateOfLeadId: { type: "string", format: "uuid" },
      geoLatitude: { type: "number" }, geoLongitude: { type: "number" },
    } } },
  }, async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const { sourceType, summary, details } = body as { sourceType: string; summary: string; details?: string };
    const { userId } = request.authUser!;
    const unitId = request.authUser?.unitId || null;
    // Duplicate detection using pg_trgm similarity on summary
    let duplicateScore = 0;
    let duplicateOfId: string | null = (body.duplicateOfLeadId as string) || null;
    if (!duplicateOfId) {
      const dupeCheck = await query(
        `SELECT lead_id, similarity(summary, $1) AS score
         FROM lead
         WHERE similarity(summary, $1) > 0.4
           AND unit_id = $2::uuid
         ORDER BY score DESC LIMIT 1`,
        [summary, unitId],
      ).catch(() => ({ rows: [] })); // pg_trgm may not be installed
      if (dupeCheck.rows.length > 0) {
        duplicateScore = parseFloat(dupeCheck.rows[0].score) || 0;
        if (duplicateScore > 0.7) {
          duplicateOfId = dupeCheck.rows[0].lead_id;
        }
      }
    }

    const refResult = await query(`SELECT 'DOP-LEAD-' || EXTRACT(YEAR FROM NOW())::text || '-' || LPAD(nextval('dopams_lead_ref_seq')::text, 6, '0') AS ref`);
    const leadRef = refResult.rows[0].ref;
    const result = await query(
      `INSERT INTO lead (lead_ref, source_type, summary, details, created_by, unit_id,
        channel, informant_name, informant_contact, urgency, duplicate_of_lead_id, duplicate_score, geo_latitude, geo_longitude)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING lead_id, lead_ref, source_type, summary, details, priority, state_id, unit_id,
                 channel, urgency, duplicate_of_lead_id, duplicate_score, created_by, created_at`,
      [leadRef, sourceType, summary, details || null, userId, unitId,
       body.channel || null, body.informantName || null, body.informantContact || null,
       body.urgency || "NORMAL", duplicateOfId,
       duplicateScore, body.geoLatitude || null, body.geoLongitude || null],
    );

    // Auto-generate memo if urgency is HIGH or CRITICAL
    const newLead = result.rows[0];
    if (body.urgency === "HIGH" || body.urgency === "CRITICAL") {
      try {
        const memoRef = await query(`SELECT 'DOP-MEMO-' || EXTRACT(YEAR FROM NOW())::text || '-' || LPAD(nextval('dopams_memo_ref_seq')::text, 6, '0') AS ref`);
        await query(
          `INSERT INTO memo (lead_id, memo_number, subject, body, created_by)
           VALUES ($1, $2, $3, $4, $5)`,
          [newLead.lead_id, memoRef.rows[0].ref, `Auto-memo: ${summary.substring(0, 100)}`, `Auto-generated memo for ${body.urgency} lead.\n\n${summary}`, userId],
        );
        await query(`UPDATE lead SET auto_memo_generated = TRUE WHERE lead_id = $1`, [newLead.lead_id]);
        newLead.auto_memo_generated = true;
      } catch (memoErr) {
        request.log.warn(memoErr, "Auto-memo generation failed");
      }
    }

    reply.code(201);
    return { lead: newLead, ...(duplicateScore > 0.4 ? { duplicateWarning: { score: duplicateScore, matchedLeadId: duplicateOfId } } : {}) };
  });

  app.get("/api/v1/leads/:id", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const unitId = request.authUser?.unitId || null;
    const result = await query(
      `SELECT lead_id, lead_ref, source_type, summary, details, priority, state_id, row_version,
              subject_id, assigned_to, channel, informant_name, informant_contact, urgency,
              duplicate_of_lead_id, auto_memo_generated, geo_latitude, geo_longitude,
              created_by, created_at, updated_at
       FROM lead WHERE lead_id = $1 AND unit_id = $2::uuid`,
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
