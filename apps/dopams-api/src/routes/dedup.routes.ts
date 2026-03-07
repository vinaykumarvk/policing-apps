import { FastifyInstance } from "fastify";
import { query } from "../db";
import { send400, send404, sendError } from "../errors";
import { findDuplicates, mergeSubjects, rejectCandidate, unmergeSubjects } from "../services/deduplication";

export async function registerDedupRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/v1/dedup/candidates
   * Paginated list of deduplication candidates, optionally filtered by state and min score.
   */
  app.get("/api/v1/dedup/candidates", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          state_id: { type: "string", maxLength: 50 },
          min_score: { type: "number", minimum: 0, maximum: 1 },
          limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
          offset: { type: "integer", minimum: 0, default: 0 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { state_id, min_score, limit: rawLimit, offset: rawOffset } =
        request.query as { state_id?: string; min_score?: number; limit?: number; offset?: number };
      const limit = Math.min(Math.max(rawLimit ?? 50, 1), 200);
      const offset = Math.max(rawOffset ?? 0, 0);
      const minScore = min_score ?? 0;

      const result = await query(
        `SELECT dc.candidate_id,
                dc.subject_id_a, sa.full_name AS full_name_a, sa.subject_ref AS subject_ref_a,
                dc.subject_id_b, sb.full_name AS full_name_b, sb.subject_ref AS subject_ref_b,
                dc.similarity_score, dc.match_reasons, dc.state_id,
                dc.reviewed_by, dc.reviewed_at, dc.created_at,
                COUNT(*) OVER() AS total_count
         FROM dedup_candidate dc
         JOIN subject_profile sa ON sa.subject_id = dc.subject_id_a
         JOIN subject_profile sb ON sb.subject_id = dc.subject_id_b
         WHERE ($1::text IS NULL OR dc.state_id = $1)
           AND dc.similarity_score >= $2
         ORDER BY dc.similarity_score DESC, dc.created_at DESC
         LIMIT $3 OFFSET $4`,
        [state_id || null, minScore, limit, offset],
      );
      const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
      return { candidates: result.rows.map(({ total_count, ...r }) => r), total };
    } catch (err: unknown) {
      request.log.error(err, "Failed to list dedup candidates");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  /**
   * POST /api/v1/dedup/scan
   * Trigger a deduplication scan to populate the candidate table.
   */
  app.post("/api/v1/dedup/scan", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        properties: {
          minSimilarity: { type: "number", minimum: 0.1, maximum: 1, default: 0.5 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { minSimilarity = 0.5 } = (request.body as { minSimilarity?: number }) ?? {};
      const inserted = await findDuplicates(minSimilarity);
      return { candidatesFound: inserted, minSimilarity };
    } catch (err: unknown) {
      request.log.error(err, "Failed to run dedup scan");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  /**
   * POST /api/v1/dedup/merge
   * Merge two subject records. survivorId wins; fieldDecisions governs per-field overrides.
   */
  app.post("/api/v1/dedup/merge", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["survivorId", "mergedId"],
        properties: {
          survivorId: { type: "string", format: "uuid" },
          mergedId: { type: "string", format: "uuid" },
          fieldDecisions: {
            type: "object",
            additionalProperties: { type: "string", enum: ["survivor", "merged"] },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { survivorId, mergedId, fieldDecisions = {} } =
        request.body as { survivorId: string; mergedId: string; fieldDecisions?: Record<string, "survivor" | "merged"> };

      if (survivorId === mergedId) {
        return send400(reply, "SAME_SUBJECT", "survivorId and mergedId must be different");
      }

      const { userId } = request.authUser!;
      const result = await mergeSubjects(survivorId, mergedId, fieldDecisions, userId);
      return { merge: result };
    } catch (err: unknown) {
      const e = err as Error & { code?: string };
      if (e.code === "CANDIDATE_NOT_FOUND" || e.message?.includes("not found")) {
        return send404(reply, "SUBJECT_NOT_FOUND", e.message || "Subject not found");
      }
      request.log.error(err, "Failed to merge subjects");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  /**
   * POST /api/v1/dedup/candidates/:id/reject
   * Mark a dedup candidate as rejected.
   */
  app.post("/api/v1/dedup/candidates/:id/reject", {
    schema: {
      params: {
        type: "object",
        additionalProperties: false,
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { userId } = request.authUser!;
      await rejectCandidate(id, userId);
      return { success: true, candidateId: id };
    } catch (err: unknown) {
      const e = err as Error & { code?: string };
      if (e.code === "CANDIDATE_NOT_FOUND") {
        return send404(reply, "CANDIDATE_NOT_FOUND", "Candidate not found or already resolved");
      }
      request.log.error(err, "Failed to reject dedup candidate");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  /**
   * POST /api/v1/dedup/:id/unmerge
   * FR-25: Reverse a merge by restoring the original records.
   * :id is the merge_history_id (or merge_id) of the merge to reverse.
   */
  app.post("/api/v1/dedup/:id/unmerge", {
    schema: {
      params: {
        type: "object",
        additionalProperties: false,
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
      body: {
        type: "object",
        additionalProperties: false,
        required: ["reason"],
        properties: {
          reason: { type: "string", minLength: 1, maxLength: 1000 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { reason } = request.body as { reason: string };
      const { userId } = request.authUser!;

      const result = await unmergeSubjects(id, reason, userId);
      return { success: true, survivorId: result.survivorId, restoredId: result.restoredId };
    } catch (err: unknown) {
      const e = err as Error & { code?: string };
      if (e.code === "MERGE_NOT_FOUND") {
        return send404(reply, "MERGE_NOT_FOUND", "Merge history record not found");
      }
      if (e.code === "ALREADY_UNMERGED") {
        return send400(reply, "ALREADY_UNMERGED", "Subject has already been unmerged");
      }
      request.log.error(err, "Failed to unmerge subjects");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });
}
