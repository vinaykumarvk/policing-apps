import { FastifyInstance } from "fastify";
import { query } from "../db";
import { send400, send404 } from "../errors";

export async function registerSubjectRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/subjects", async () => {
    const result = await query(
      `SELECT subject_id, full_name, aliases, date_of_birth, gender, risk_score,
              state_id, created_by, created_at
       FROM subject_profile ORDER BY created_at DESC`,
    );
    return { subjects: result.rows, total: result.rows.length };
  });

  app.get("/api/v1/subjects/:id", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await query(
      `SELECT subject_id, full_name, aliases, date_of_birth, gender, identifiers, addresses,
              photo_url, risk_score, state_id, row_version, created_by, created_at, updated_at
       FROM subject_profile WHERE subject_id = $1`,
      [id],
    );
    if (result.rows.length === 0) {
      return send404(reply, "SUBJECT_NOT_FOUND", "Subject not found");
    }
    return { subject: result.rows[0] };
  });

  app.post("/api/v1/subjects", {
    schema: { body: { type: "object", additionalProperties: false, required: ["fullName"], properties: { fullName: { type: "string" }, aliases: { type: "array", items: { type: "string" } }, identifiers: { type: "object", additionalProperties: true } } } },
  }, async (request, reply) => {
    const { fullName, aliases, identifiers } = request.body as { fullName: string; aliases?: string[]; identifiers?: Record<string, unknown> };
    const { userId } = request.authUser!;
    const result = await query(
      `INSERT INTO subject_profile (full_name, aliases, identifiers, created_by) VALUES ($1, $2, $3, $4)
       RETURNING subject_id, full_name, aliases, identifiers, state_id, created_by, created_at`,
      [fullName, JSON.stringify(aliases || []), JSON.stringify(identifiers || {}), userId],
    );
    reply.code(201);
    return { subject: result.rows[0] };
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
}
