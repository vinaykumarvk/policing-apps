import { FastifyInstance } from "fastify";
import { query } from "../db";
import { send400, send404, sendError } from "../errors";
import {
  setLegalHold,
  releaseLegalHold,
  archiveCase,
  requestPurge,
  approvePurge,
} from "../services/data-lifecycle";

export async function registerDataLifecycleRoutes(app: FastifyInstance): Promise<void> {
  const uuidParam = {
    type: "object" as const,
    additionalProperties: false,
    required: ["id"],
    properties: { id: { type: "string" as const, format: "uuid" } },
  };

  // POST /api/v1/cases/:id/legal-hold — Set legal hold
  app.post("/api/v1/cases/:id/legal-hold", {
    schema: {
      params: uuidParam,
      body: {
        type: "object",
        additionalProperties: false,
        required: ["reason"],
        properties: { reason: { type: "string" } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { reason } = request.body as { reason: string };
    const { userId } = request.authUser!;

    const caseRow = await query(`SELECT case_id FROM forensic_case WHERE case_id = $1`, [id]);
    if (caseRow.rows.length === 0) return send404(reply, "CASE_NOT_FOUND", "Case not found");

    const result = await setLegalHold(id, userId, reason);
    if (!result.success) return sendError(reply, 409, "HOLD_FAILED", "Legal hold could not be set (already active or invalid state)");
    return { success: true, caseId: id, legalHoldStatus: "ACTIVE" };
  });

  // DELETE /api/v1/cases/:id/legal-hold — Release legal hold
  app.delete("/api/v1/cases/:id/legal-hold", {
    schema: { params: uuidParam },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { userId } = request.authUser!;

    const result = await releaseLegalHold(id, userId);
    if (!result.success) return sendError(reply, 409, "RELEASE_FAILED", "Legal hold could not be released (not active or not owner)");
    return { success: true, caseId: id, legalHoldStatus: "RELEASED" };
  });

  // POST /api/v1/cases/:id/archive — Archive a closed case
  app.post("/api/v1/cases/:id/archive", {
    schema: { params: uuidParam },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const caseRow = await query(`SELECT case_id, state_id, legal_hold_status FROM forensic_case WHERE case_id = $1`, [id]);
    if (caseRow.rows.length === 0) return send404(reply, "CASE_NOT_FOUND", "Case not found");
    if (caseRow.rows[0].state_id !== "CLOSED") return sendError(reply, 400, "NOT_CLOSED", "Only closed cases can be archived");
    if (caseRow.rows[0].legal_hold_status === "ACTIVE") return sendError(reply, 409, "LEGAL_HOLD_ACTIVE", "Cannot archive a case under legal hold");

    const result = await archiveCase(id);
    if (!result.success) return sendError(reply, 409, "ARCHIVE_FAILED", "Case could not be archived");
    return { success: true, caseId: id, state: "ARCHIVED" };
  });

  // POST /api/v1/cases/:id/purge-request — Request purge of archived case
  app.post("/api/v1/cases/:id/purge-request", {
    schema: { params: uuidParam },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { userId } = request.authUser!;

    const caseRow = await query(`SELECT case_id, state_id FROM forensic_case WHERE case_id = $1`, [id]);
    if (caseRow.rows.length === 0) return send404(reply, "CASE_NOT_FOUND", "Case not found");
    if (caseRow.rows[0].state_id !== "ARCHIVED") return sendError(reply, 400, "NOT_ARCHIVED", "Only archived cases can be purge-requested");

    const result = await requestPurge(id, userId);
    if (!result.success) return sendError(reply, 409, "PURGE_REQUEST_FAILED", "Purge already requested or case under legal hold");
    return { success: true, caseId: id, purgeRequestedBy: userId };
  });

  // POST /api/v1/cases/:id/purge-approve — Approve purge (different user)
  app.post("/api/v1/cases/:id/purge-approve", {
    schema: { params: uuidParam },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { userId } = request.authUser!;

    const result = await approvePurge(id, userId);
    if (!result.success) return sendError(reply, 409, "PURGE_APPROVE_FAILED", "Cannot approve purge (not requested, already approved, or self-approval)");
    return { success: true, caseId: id, purgeApprovedBy: userId };
  });

  // GET /api/v1/cases/legal-holds — List cases under legal hold
  app.get("/api/v1/cases/legal-holds", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
          offset: { type: "integer", minimum: 0, default: 0 },
        },
      },
    },
  }, async (request) => {
    const { limit: rawLimit, offset: rawOffset } = request.query as Record<string, string | undefined>;
    const limit = Math.min(parseInt(rawLimit || "50", 10) || 50, 200);
    const offset = Math.max(parseInt(rawOffset || "0", 10) || 0, 0);

    const result = await query(
      `SELECT case_id, case_number, title, legal_hold_status, legal_hold_by, legal_hold_at, legal_hold_reason,
              COUNT(*) OVER() AS total_count
       FROM forensic_case
       WHERE legal_hold_status = 'ACTIVE'
       ORDER BY legal_hold_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
    return { cases: result.rows.map(({ total_count, ...r }) => r), total };
  });

  // GET /api/v1/cases/purge-pending — List cases pending purge approval
  app.get("/api/v1/cases/purge-pending", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
          offset: { type: "integer", minimum: 0, default: 0 },
        },
      },
    },
  }, async (request) => {
    const { limit: rawLimit, offset: rawOffset } = request.query as Record<string, string | undefined>;
    const limit = Math.min(parseInt(rawLimit || "50", 10) || 50, 200);
    const offset = Math.max(parseInt(rawOffset || "0", 10) || 0, 0);

    const result = await query(
      `SELECT case_id, case_number, title, purge_requested_by, purge_requested_at,
              COUNT(*) OVER() AS total_count
       FROM forensic_case
       WHERE purge_requested_by IS NOT NULL AND purge_approved_by IS NULL
       ORDER BY purge_requested_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
    return { cases: result.rows.map(({ total_count, ...r }) => r), total };
  });
}
