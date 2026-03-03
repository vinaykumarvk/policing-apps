import { FastifyInstance } from "fastify";
import { query } from "../db";
import { send404 } from "../errors";

export async function registerImportRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/imports", async () => {
    const result = await query(
      `SELECT import_job_id, case_id, evidence_id, job_type, state_id,
              progress_pct, started_at, completed_at, created_at
       FROM import_job ORDER BY created_at DESC`,
    );
    return { imports: result.rows, total: result.rows.length };
  });

  app.get("/api/v1/imports/:id", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await query(
      `SELECT import_job_id, case_id, evidence_id, job_type, state_id, row_version,
              progress_pct, error_message, warnings, started_at, completed_at, created_at, updated_at
       FROM import_job WHERE import_job_id = $1`,
      [id],
    );
    if (result.rows.length === 0) {
      return send404(reply, "IMPORT_NOT_FOUND", "Import job not found");
    }
    return { import: result.rows[0] };
  });
}
