import { FastifyInstance } from "fastify";
import { query } from "../db";
import { send400, send404, sendError } from "../errors";
import { crossPlatformLink } from "../services/actor-aggregator";

export async function registerActorRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/v1/actors
   * Paginated list of social media actors, filterable by repeat offender status and risk score.
   */
  app.get("/api/v1/actors", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          is_repeat_offender: { type: "string", maxLength: 10 },
          min_risk_score: { type: "number", minimum: 0, maximum: 1 },
          limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
          offset: { type: "integer", minimum: 0, default: 0 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { is_repeat_offender, min_risk_score, limit: rawLimit, offset: rawOffset } =
        request.query as { is_repeat_offender?: string; min_risk_score?: number; limit?: number; offset?: number };

      const limit = Math.min(Math.max(rawLimit ?? 50, 1), 200);
      const offset = Math.max(rawOffset ?? 0, 0);
      const isRepeatOffender = is_repeat_offender === undefined ? null : is_repeat_offender === "true";
      const minRisk = min_risk_score ?? 0;

      const result = await query(
        `SELECT actor_id, handles, display_name, risk_score, total_flagged_posts,
                is_repeat_offender, is_active, first_seen_at, last_seen_at, created_at,
                COUNT(*) OVER() AS total_count
         FROM sm_actor
         WHERE is_active = TRUE
           AND ($1::boolean IS NULL OR is_repeat_offender = $1)
           AND risk_score >= $2
         ORDER BY risk_score DESC, last_seen_at DESC
         LIMIT $3 OFFSET $4`,
        [isRepeatOffender, minRisk, limit, offset],
      );
      const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
      return { actors: result.rows.map(({ total_count, ...r }) => r), total };
    } catch (err: unknown) {
      request.log.error(err, "Failed to list actors");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  /**
   * GET /api/v1/actors/:id
   * Retrieve a single actor by ID.
   */
  app.get("/api/v1/actors/:id", {
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
      const result = await query(
        `SELECT actor_id, handles, display_name, risk_score, total_flagged_posts,
                is_repeat_offender, is_active, first_seen_at, last_seen_at,
                metadata_jsonb, created_at, updated_at
         FROM sm_actor WHERE actor_id = $1`,
        [id],
      );
      if (result.rows.length === 0) {
        return send404(reply, "ACTOR_NOT_FOUND", "Actor not found");
      }
      return { actor: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get actor");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  /**
   * GET /api/v1/actors/:id/posts
   * Retrieve content items linked to a given actor.
   */
  app.get("/api/v1/actors/:id/posts", {
    schema: {
      params: {
        type: "object",
        additionalProperties: false,
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
          offset: { type: "integer", minimum: 0, default: 0 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { limit: rawLimit, offset: rawOffset } = request.query as { limit?: number; offset?: number };
      const limit = Math.min(Math.max(rawLimit ?? 50, 1), 200);
      const offset = Math.max(rawOffset ?? 0, 0);

      // Verify actor exists
      const actorCheck = await query(`SELECT actor_id FROM sm_actor WHERE actor_id = $1`, [id]);
      if (actorCheck.rows.length === 0) {
        return send404(reply, "ACTOR_NOT_FOUND", "Actor not found");
      }

      const result = await query(
        `SELECT ci.content_id, ci.platform, ci.author_handle, ci.author_name,
                ci.content_text, ci.content_url, ci.language, ci.sentiment,
                ci.threat_score, ci.published_at, ci.ingested_at,
                COUNT(*) OVER() AS total_count
         FROM content_item ci
         WHERE ci.actor_id = $1
         ORDER BY ci.published_at DESC
         LIMIT $2 OFFSET $3`,
        [id, limit, offset],
      );
      const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
      return { posts: result.rows.map(({ total_count, ...r }) => r), total };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get actor posts");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  /**
   * POST /api/v1/actors/link
   * Cross-platform link: merge two actor records. Survivor is chosen by earliest first_seen_at.
   */
  app.post("/api/v1/actors/link", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["actorIdA", "actorIdB"],
        properties: {
          actorIdA: { type: "string", format: "uuid" },
          actorIdB: { type: "string", format: "uuid" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { actorIdA, actorIdB } = request.body as { actorIdA: string; actorIdB: string };

      if (actorIdA === actorIdB) {
        return send400(reply, "SAME_ACTOR", "actorIdA and actorIdB must be different");
      }

      const result = await crossPlatformLink(actorIdA, actorIdB);
      return { link: result };
    } catch (err: unknown) {
      const e = err as Error & { code?: string };
      if (e.code === "ACTOR_A_NOT_FOUND") return send404(reply, "ACTOR_A_NOT_FOUND", "Actor A not found");
      if (e.code === "ACTOR_B_NOT_FOUND") return send404(reply, "ACTOR_B_NOT_FOUND", "Actor B not found");
      request.log.error(err, "Failed to cross-platform link actors");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });
}
