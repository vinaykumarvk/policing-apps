import { FastifyInstance } from "fastify";
import { query } from "../db";
import { send400, send404, sendError } from "../errors";
import { executeTransition } from "../workflow-bridge";
import { getAvailableTransitions } from "../workflow-bridge/transitions";

const PRIVILEGED_ROLES = ["ADMINISTRATOR", "PLATFORM_ADMINISTRATOR", "INTELLIGENCE_ANALYST", "INVESTIGATING_OFFICER"];

function maskSubjectPII(row: Record<string, unknown>, userRoles: string[]): Record<string, unknown> {
  if (!userRoles.some((r) => PRIVILEGED_ROLES.includes(r))) {
    row.identifiers = row.identifiers ? "[REDACTED]" : null;
    row.addresses = row.addresses ? "[REDACTED]" : null;
  }
  return row;
}

export async function registerSubjectRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/subjects", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          state_id: { type: "string", maxLength: 100 },
          gender: { type: "string", maxLength: 50 },
          limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
          offset: { type: "integer", minimum: 0, default: 0 },
        },
      },
    },
  }, async (request) => {
    const { state_id, gender, limit: rawLimit, offset: rawOffset } = request.query as Record<string, string | undefined>;
    const unitId = request.authUser?.unitId || null;
    const limit = Math.min(Math.max(parseInt(rawLimit || "50", 10) || 50, 1), 200);
    const offset = Math.max(parseInt(rawOffset || "0", 10) || 0, 0);

    const result = await query(
      `SELECT subject_id, subject_ref, full_name, aliases, date_of_birth, gender, risk_score,
              state_id, created_by, created_at,
              COUNT(*) OVER() AS total_count
       FROM subject_profile
       WHERE ($1::text IS NULL OR state_id = $1)
         AND ($2::text IS NULL OR gender = $2)
         AND ($3::text IS NULL OR unit_id = $3)
       ORDER BY created_at DESC
       LIMIT $4 OFFSET $5`,
      [state_id || null, gender || null, unitId, limit, offset],
    );
    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
    return { subjects: result.rows.map(({ total_count, ...r }) => r), total };
  });

  app.get("/api/v1/subjects/:id", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const unitId = request.authUser?.unitId || null;
    const result = await query(
      `SELECT subject_id, subject_ref, full_name, aliases, date_of_birth, gender, identifiers, addresses,
              photo_url, risk_score, state_id, row_version, created_by, created_at, updated_at
       FROM subject_profile WHERE subject_id = $1 AND ($2::text IS NULL OR unit_id = $2)`,
      [id, unitId],
    );
    if (result.rows.length === 0) {
      return send404(reply, "SUBJECT_NOT_FOUND", "Subject not found");
    }
    const subject = maskSubjectPII(result.rows[0], request.authUser?.roles ?? []);
    return { subject };
  });

  app.post("/api/v1/subjects", {
    schema: { body: { type: "object", additionalProperties: false, required: ["fullName"], properties: { fullName: { type: "string" }, aliases: { type: "array", items: { type: "string" } }, identifiers: { type: "object", additionalProperties: true } } } },
  }, async (request, reply) => {
    const { fullName, aliases, identifiers } = request.body as { fullName: string; aliases?: string[]; identifiers?: Record<string, unknown> };
    const { userId } = request.authUser!;
    const unitId = request.authUser?.unitId || null;
    const refResult = await query(`SELECT 'DOP-SUBJ-' || EXTRACT(YEAR FROM NOW())::text || '-' || LPAD(nextval('dopams_subject_ref_seq')::text, 6, '0') AS ref`);
    const subjectRef = refResult.rows[0].ref;
    const result = await query(
      `INSERT INTO subject_profile (subject_ref, full_name, aliases, identifiers, created_by, unit_id) VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING subject_id, subject_ref, full_name, aliases, identifiers, state_id, unit_id, created_by, created_at`,
      [subjectRef, fullName, JSON.stringify(aliases || []), JSON.stringify(identifiers || {}), userId, unitId],
    );
    reply.code(201);
    return { subject: maskSubjectPII(result.rows[0], request.authUser?.roles ?? []) };
  });

  app.put("/api/v1/subjects/:id", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: { type: "object", additionalProperties: false, properties: { fullName: { type: "string" }, aliases: { type: "array", items: { type: "string" } } } },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { fullName, aliases } = request.body as { fullName?: string; aliases?: string[] };

    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (fullName !== undefined) { sets.push(`full_name = $${idx++}`); params.push(fullName); }
    if (aliases !== undefined) { sets.push(`aliases = $${idx++}`); params.push(JSON.stringify(aliases)); }

    if (sets.length === 0) {
      return send400(reply, "NO_FIELDS", "No fields to update");
    }

    sets.push(`updated_at = NOW()`);
    params.push(id);

    const result = await query(
      `UPDATE subject_profile SET ${sets.join(", ")} WHERE subject_id = $${idx}
       RETURNING subject_id, full_name, aliases, state_id, updated_at`,
      params,
    );
    if (result.rows.length === 0) {
      return send404(reply, "SUBJECT_NOT_FOUND", "Subject not found");
    }
    return { subject: result.rows[0] };
  });

  app.get("/api/v1/subjects/:id/transitions", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await query(`SELECT state_id FROM subject_profile WHERE subject_id = $1`, [id]);
    if (result.rows.length === 0) return send404(reply, "SUBJECT_NOT_FOUND", "Subject not found");
    return { transitions: getAvailableTransitions("dopams_subject", result.rows[0].state_id) };
  });

  app.post("/api/v1/subjects/:id/transition", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: { type: "object", additionalProperties: false, required: ["transitionId"], properties: { transitionId: { type: "string" }, remarks: { type: "string" } } },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { transitionId, remarks } = request.body as { transitionId: string; remarks?: string };
    const { userId, roles } = request.authUser!;

    // Validate transition is allowed from current state
    const stateResult = await query(`SELECT state_id FROM subject_profile WHERE subject_id = $1`, [id]);
    if (stateResult.rows.length === 0) return send404(reply, "SUBJECT_NOT_FOUND", "Subject not found");
    const available = getAvailableTransitions("dopams_subject", stateResult.rows[0].state_id);
    if (!available.some((t) => t.transitionId === transitionId)) {
      return sendError(reply, 400, "INVALID_TRANSITION", "Transition not allowed from current state");
    }

    const result = await executeTransition(
      id, "dopams_subject", transitionId, userId, "OFFICER", roles, remarks,
    );
    if (!result.success) {
      return sendError(reply, 409, result.error || "TRANSITION_FAILED", "Subject transition failed");
    }
    return { success: true, newStateId: result.newStateId };
  });
}
