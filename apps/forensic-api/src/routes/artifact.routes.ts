import { FastifyInstance } from "fastify";
import { query } from "../db";
import { send400, send404, sendError } from "../errors";
import { createDerivedArtifact, getDerivedArtifacts } from "../services/derived-artifact";

export async function registerArtifactRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/cases/:caseId/artifacts", {
    schema: { params: { type: "object", additionalProperties: false, required: ["caseId"], properties: { caseId: { type: "string", format: "uuid" } } } },
  }, async (request) => {
    const { caseId } = request.params as { caseId: string };
    const result = await query(
      `SELECT artifact_id, case_id, import_job_id, artifact_type, source_path,
              content_preview, metadata_jsonb, is_derived, derived_from_id, derivation_method,
              hash_sha256, parser_version, source_tool, created_at
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
              content_preview, metadata_jsonb, is_derived, derived_from_id, derivation_method,
              hash_sha256, parser_version, source_tool, created_at
       FROM artifact WHERE artifact_id = $1`,
      [id],
    );
    if (result.rows.length === 0) {
      return send404(reply, "ARTIFACT_NOT_FOUND", "Artifact not found");
    }
    return { artifact: result.rows[0] };
  });

  // POST /api/v1/artifacts/:id/derived — Create derived artifact
  app.post("/api/v1/artifacts/:id/derived", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: {
        type: "object",
        additionalProperties: false,
        required: ["artifactType", "derivationMethod", "contentPreview"],
        properties: {
          artifactType: { type: "string" },
          derivationMethod: { type: "string" },
          contentPreview: { type: "string" },
          metadata: { type: "object", additionalProperties: true },
          hashSha256: { type: "string" },
          parserVersion: { type: "string" },
          sourceTool: { type: "string" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;

      // Get source artifact's case_id
      const source = await query(`SELECT case_id FROM artifact WHERE artifact_id = $1`, [id]);
      if (source.rows.length === 0) return send404(reply, "ARTIFACT_NOT_FOUND", "Source artifact not found");

      const derived = await createDerivedArtifact({
        caseId: source.rows[0].case_id,
        sourceArtifactId: id,
        artifactType: body.artifactType as string,
        derivationMethod: body.derivationMethod as string,
        contentPreview: body.contentPreview as string,
        metadata: body.metadata as Record<string, unknown>,
        hashSha256: body.hashSha256 as string,
        parserVersion: body.parserVersion as string | undefined,
        sourceTool: body.sourceTool as string | undefined,
      });

      reply.code(201);
      return { artifact: derived };
    } catch (err: unknown) {
      request.log.error(err, "Failed to create derived artifact");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // GET /api/v1/artifacts/:id/derived — List derived artifacts
  app.get("/api/v1/artifacts/:id/derived", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const artifacts = await getDerivedArtifacts(id);
    return { artifacts, total: artifacts.length };
  });
}
