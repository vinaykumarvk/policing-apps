import { FastifyInstance } from "fastify";
import { query } from "../db";
import { sendError, send404 } from "../errors";

export async function registerImportRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/imports", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          state_id: { type: "string", maxLength: 100 },
          limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
          offset: { type: "integer", minimum: 0, default: 0 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { state_id, limit: rawLimit, offset: rawOffset } = request.query as Record<string, string | undefined>;
      const limit = Math.min(Math.max(parseInt(rawLimit || "50", 10) || 50, 1), 200);
      const offset = Math.max(parseInt(rawOffset || "0", 10) || 0, 0);

      const result = await query(
        `SELECT import_job_id, case_id, evidence_id, job_type, state_id,
                progress_pct, started_at, completed_at, created_at,
                COUNT(*) OVER() AS total_count
         FROM import_job
         WHERE ($1::text IS NULL OR state_id = $1)
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [state_id || null, limit, offset],
      );
      const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
      return { imports: result.rows.map(({ total_count, ...r }) => r), total };
    } catch (err: unknown) {
      request.log.error(err, "Failed to list imports");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  app.get("/api/v1/imports/:id", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    try {
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
    } catch (err: unknown) {
      request.log.error(err, "Failed to get import job");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });
}
