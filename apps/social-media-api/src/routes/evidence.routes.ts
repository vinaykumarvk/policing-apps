import { FastifyInstance } from "fastify";
import { query } from "../db";
import { sendError, send404 } from "../errors";
import { executeTransition } from "../workflow-bridge";

export async function registerEvidenceRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/v1/evidence/capture", {
    schema: { body: { type: "object", additionalProperties: false, required: ["contentId"], properties: { contentId: { type: "string", format: "uuid" }, captureType: { type: "string" }, notes: { type: "string" } } } },
  }, async (request, reply) => {
    const { contentId, captureType, notes } = request.body as { contentId: string; captureType?: string; notes?: string };
    const { userId } = request.authUser!;
    const result = await query(
      `INSERT INTO evidence_item (content_id, capture_type, captured_by)
       VALUES ($1, $2, $3)
       RETURNING evidence_id, content_id, capture_type, state_id, captured_by, created_at`,
      [contentId, captureType || "MANUAL", userId],
    );
    reply.code(201);
    return { evidence: result.rows[0] };
  });

  app.get("/api/v1/evidence/:id", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await query(
      `SELECT evidence_id, content_id, alert_id, case_id, capture_type, screenshot_url,
              archive_url, hash_sha256, chain_of_custody, state_id, row_version,
              captured_by, created_at, updated_at
       FROM evidence_item WHERE evidence_id = $1`,
      [id],
    );
    if (result.rows.length === 0) {
      return send404(reply, "EVIDENCE_NOT_FOUND", "Evidence not found");
    }
    return { evidence: result.rows[0] };
  });

  app.post("/api/v1/evidence/:id/transition", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: { type: "object", additionalProperties: false, required: ["transitionId"], properties: { transitionId: { type: "string" }, remarks: { type: "string" } } },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { transitionId, remarks } = request.body as { transitionId: string; remarks?: string };
    const { userId, roles } = request.authUser!;

    const result = await executeTransition(
      id, "sm_evidence", transitionId, userId, "OFFICER", roles, remarks,
    );
    if (!result.success) {
      return sendError(reply, 409, result.error || "TRANSITION_FAILED", "Evidence transition failed");
    }
    return { success: true, newStateId: result.newStateId };
  });
}
