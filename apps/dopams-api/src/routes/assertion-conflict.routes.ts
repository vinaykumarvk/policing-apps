import { FastifyInstance } from "fastify";
import { query } from "../db";
import { send404, sendError } from "../errors";
import { createRoleGuard } from "@puda/api-core";

export async function registerAssertionConflictRoutes(app: FastifyInstance): Promise<void> {
  const requireAnalyst = createRoleGuard(["INTELLIGENCE_ANALYST", "SUPERVISORY_OFFICER", "ADMINISTRATOR"]);

  // FR-04 AC-05: List assertion conflicts for a subject
  app.get("/api/v1/subjects/:id/conflicts", {
    schema: {
      params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          resolved: { type: "string", enum: ["true", "false"] },
          limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
          offset: { type: "integer", minimum: 0, default: 0 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const qs = request.query as Record<string, string | undefined>;
      const limit = Math.min(parseInt(qs.limit || "50", 10) || 50, 200);
      const offset = Math.max(parseInt(qs.offset || "0", 10) || 0, 0);

      const result = await query(
        `SELECT conflict_id, subject_id, field_name, source_a, value_a, source_b, value_b,
                resolved_source, resolved_by, resolved_at, created_at,
                COUNT(*) OVER() AS total_count
         FROM assertion_conflict
         WHERE subject_id = $1
           AND ($2::boolean IS NULL OR (resolved_by IS NOT NULL) = $2)
         ORDER BY created_at DESC
         LIMIT $3 OFFSET $4`,
        [id, qs.resolved === undefined ? null : qs.resolved === "true", limit, offset],
      );
      const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
      return { conflicts: result.rows.map(({ total_count, ...r }: any) => r), total };
    } catch (err: unknown) {
      request.log.error(err, "Failed to list assertion conflicts");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // FR-04 BR-01/BR-02: Resolve an assertion conflict
  app.post("/api/v1/subjects/conflicts/:conflictId/resolve", {
    schema: {
      params: { type: "object", required: ["conflictId"], properties: { conflictId: { type: "string", format: "uuid" } } },
      body: {
        type: "object",
        additionalProperties: false,
        required: ["resolvedSource"],
        properties: {
          resolvedSource: { type: "string" },
          remarks: { type: "string" },
        },
      },
    },
  }, async (request, reply) => {
    if (!requireAnalyst(request, reply)) return;
    try {
      const { conflictId } = request.params as { conflictId: string };
      const { resolvedSource, remarks } = request.body as { resolvedSource: string; remarks?: string };
      const { userId } = request.authUser!;

      const result = await query(
        `UPDATE assertion_conflict
         SET resolved_source = $1, resolved_by = $2, resolved_at = NOW()
         WHERE conflict_id = $3
         RETURNING conflict_id, subject_id, field_name, resolved_source`,
        [resolvedSource, userId, conflictId],
      );
      if (result.rows.length === 0) {
        return send404(reply, "CONFLICT_NOT_FOUND", "Assertion conflict not found");
      }
      return { conflict: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to resolve assertion conflict");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });
}
