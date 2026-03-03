import { FastifyInstance } from "fastify";
import { query } from "../db";
import { send404 } from "../errors";

export async function registerCaseRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/cases", async () => {
    const result = await query(
      `SELECT case_id, case_number, title, case_type, priority, state_id,
              assigned_to, created_by, created_at
       FROM dopams_case ORDER BY created_at DESC`,
    );
    return { cases: result.rows, total: result.rows.length };
  });

  app.get("/api/v1/cases/:id", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await query(
      `SELECT case_id, case_number, title, description, case_type, priority, state_id, row_version,
              assigned_to, created_by, created_at, updated_at
       FROM dopams_case WHERE case_id = $1`,
      [id],
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
    const result = await query(
      `INSERT INTO dopams_case (title, description, created_by) VALUES ($1, $2, $3)
       RETURNING case_id, case_number, title, description, case_type, priority, state_id, created_by, created_at`,
      [title, description || null, userId],
    );
    reply.code(201);
    return { case: result.rows[0] };
  });
}
