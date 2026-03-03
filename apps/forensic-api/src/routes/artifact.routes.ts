import { FastifyInstance } from "fastify";
import { query } from "../db";
import { send404 } from "../errors";

export async function registerArtifactRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/cases/:caseId/artifacts", {
    schema: { params: { type: "object", additionalProperties: false, required: ["caseId"], properties: { caseId: { type: "string", format: "uuid" } } } },
  }, async (request) => {
    const { caseId } = request.params as { caseId: string };
    const result = await query(
      `SELECT artifact_id, case_id, import_job_id, artifact_type, source_path,
              content_preview, metadata_jsonb, created_at
       FROM artifact WHERE case_id = $1 ORDER BY created_at DESC`,
      [caseId],
    );
    return { artifacts: result.rows, total: result.rows.length };
  });

  app.get("/api/v1/artifacts/:id", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await query(
      `SELECT artifact_id, case_id, import_job_id, artifact_type, source_path,
              content_preview, metadata_jsonb, created_at
       FROM artifact WHERE artifact_id = $1`,
      [id],
    );
    if (result.rows.length === 0) {
      return send404(reply, "ARTIFACT_NOT_FOUND", "Artifact not found");
    }
    return { artifact: result.rows[0] };
  });
}
