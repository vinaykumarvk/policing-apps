import { FastifyInstance } from "fastify";
import { query } from "../db";
import { send404, sendError } from "../errors";
import { executeTransition } from "../workflow-bridge";
import { getAvailableTransitions } from "../workflow-bridge/transitions";

export async function registerMemoRoutes(app: FastifyInstance): Promise<void> {
  // List memos
  app.get("/api/v1/memos", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          state_id: { type: "string", maxLength: 100 },
          lead_id: { type: "string", maxLength: 100 },
          limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
          offset: { type: "integer", minimum: 0, default: 0 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { state_id, lead_id, limit: rawLimit, offset: rawOffset } = request.query as Record<string, string | undefined>;
      const limit = Math.min(Math.max(parseInt(rawLimit || "50", 10) || 50, 1), 200);
      const offset = Math.max(parseInt(rawOffset || "0", 10) || 0, 0);

      const result = await query(
        `SELECT memo_id, lead_id, memo_number, subject, state_id, created_by, created_at,
                COUNT(*) OVER() AS total_count
         FROM memo
         WHERE ($1::text IS NULL OR state_id = $1)
           AND ($2::text IS NULL OR lead_id::text = $2)
         ORDER BY created_at DESC
         LIMIT $3 OFFSET $4`,
        [state_id || null, lead_id || null, limit, offset],
      );
      const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
      return { memos: result.rows.map(({ total_count, ...r }) => r), total };
    } catch (err: unknown) {
      request.log.error(err, "Failed to list memos");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Get memo detail
  app.get("/api/v1/memos/:id", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const result = await query(
        `SELECT memo_id, lead_id, memo_number, subject, body, state_id, row_version,
                created_by, approved_by, created_at, updated_at
         FROM memo WHERE memo_id = $1`,
        [id],
      );
      if (result.rows.length === 0) {
        return send404(reply, "MEMO_NOT_FOUND", "Memo not found");
      }
      return { memo: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get memo");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Create memo
  app.post("/api/v1/memos", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["subject", "body"],
        properties: {
          subject: { type: "string" },
          body: { type: "string" },
          leadId: { type: "string", format: "uuid" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { subject, body: memoBody, leadId } = request.body as { subject: string; body: string; leadId?: string };
      const { userId } = request.authUser!;

      const refResult = await query(
        `SELECT 'DOP-MEMO-' || EXTRACT(YEAR FROM NOW())::text || '-' || LPAD(nextval('dopams_memo_ref_seq')::text, 6, '0') AS ref`,
      );
      const memoNumber = refResult.rows[0].ref;

      const result = await query(
        `INSERT INTO memo (lead_id, memo_number, subject, body, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING memo_id, lead_id, memo_number, subject, body, state_id, created_by, created_at`,
        [leadId || null, memoNumber, subject, memoBody, userId],
      );
      reply.code(201);
      return { memo: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to create memo");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Get available transitions
  app.get("/api/v1/memos/:id/transitions", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const result = await query(`SELECT state_id FROM memo WHERE memo_id = $1`, [id]);
      if (result.rows.length === 0) return send404(reply, "MEMO_NOT_FOUND", "Memo not found");
      return { transitions: getAvailableTransitions("dopams_memo", result.rows[0].state_id) };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get memo transitions");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Execute transition
  app.post("/api/v1/memos/:id/transition", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: { type: "object", additionalProperties: false, required: ["transitionId"], properties: { transitionId: { type: "string" }, remarks: { type: "string" } } },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { transitionId, remarks } = request.body as { transitionId: string; remarks?: string };
      const { userId, roles } = request.authUser!;

      const result = await executeTransition(
        id, "dopams_memo", transitionId, userId, "OFFICER", roles, remarks,
      );
      if (!result.success) {
        return sendError(reply, 409, result.error || "TRANSITION_FAILED", "Memo transition failed");
      }
      return { success: true, newStateId: result.newStateId };
    } catch (err: unknown) {
      request.log.error(err, "Failed to execute memo transition");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });
}
