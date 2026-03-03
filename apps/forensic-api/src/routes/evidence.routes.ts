import { FastifyInstance } from "fastify";
import { query } from "../db";
import { send404 } from "../errors";

export async function registerEvidenceRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/v1/cases/:id/evidence", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: { type: "object", additionalProperties: false, required: ["sourceType"], properties: { sourceType: { type: "string" }, description: { type: "string" }, filePath: { type: "string" } } },
    },
  }, async (request, reply) => {
    const { id: caseId } = request.params as { id: string };
    const { sourceType, description, filePath } = request.body as { sourceType: string; description?: string; filePath?: string };
    const { userId } = request.authUser!;

    const caseCheck = await query(`SELECT 1 FROM forensic_case WHERE case_id = $1`, [caseId]);
    if (caseCheck.rows.length === 0) {
      return send404(reply, "CASE_NOT_FOUND", "Case not found");
    }

    const result = await query(
      `INSERT INTO evidence_source (case_id, source_type, file_url, file_name, uploaded_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING evidence_id, case_id, source_type, file_url, file_name, state_id, uploaded_by, created_at`,
      [caseId, sourceType, filePath || null, description || null, userId],
    );
    reply.code(201);
    return { evidence: result.rows[0] };
  });

  app.get("/api/v1/evidence/:id", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await query(
      `SELECT evidence_id, case_id, source_type, device_info, file_url, file_name,
              file_size_bytes, hash_sha256, chain_of_custody, state_id, row_version,
              uploaded_by, created_at, updated_at
       FROM evidence_source WHERE evidence_id = $1`,
      [id],
    );
    if (result.rows.length === 0) {
      return send404(reply, "EVIDENCE_NOT_FOUND", "Evidence not found");
    }
    return { evidence: result.rows[0] };
  });
}
