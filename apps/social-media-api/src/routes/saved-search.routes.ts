import { FastifyInstance } from "fastify";
import { query } from "../db";
import { send400, send404, sendError } from "../errors";

export async function registerSavedSearchRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/v1/saved-searches
   * List saved searches for the authenticated user.
   */
  app.get("/api/v1/saved-searches", {
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
  }, async (request, reply) => {
    try {
      const { limit: rawLimit, offset: rawOffset } = request.query as { limit?: number; offset?: number };
      const limit = Math.min(Math.max(rawLimit ?? 50, 1), 200);
      const offset = Math.max(rawOffset ?? 0, 0);
      const { userId } = request.authUser!;

      const result = await query(
        `SELECT search_id, search_name, query_jsonb, alert_on_match,
                last_run_at, result_count, is_active, created_at, updated_at,
                COUNT(*) OVER() AS total_count
         FROM saved_search
         WHERE created_by = $1 AND is_active = TRUE
         ORDER BY updated_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset],
      );
      const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
      return { savedSearches: result.rows.map(({ total_count, ...r }) => r), total };
    } catch (err: unknown) {
      request.log.error(err, "Failed to list saved searches");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  /**
   * GET /api/v1/saved-searches/:id
   * Retrieve a specific saved search by ID.
   */
  app.get("/api/v1/saved-searches/:id", {
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

      const result = await query(
        `SELECT search_id, search_name, query_jsonb, alert_on_match,
                last_run_at, result_count, is_active, created_by, created_at, updated_at
         FROM saved_search
         WHERE search_id = $1 AND created_by = $2`,
        [id, userId],
      );
      if (result.rows.length === 0) {
        return send404(reply, "SAVED_SEARCH_NOT_FOUND", "Saved search not found");
      }
      return { savedSearch: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get saved search");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  /**
   * POST /api/v1/saved-searches
   * Create a new saved search.
   */
  app.post("/api/v1/saved-searches", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["searchName", "queryJsonb"],
        properties: {
          searchName: { type: "string", minLength: 1, maxLength: 200 },
          queryJsonb: { type: "object", additionalProperties: true },
          alertOnMatch: { type: "boolean", default: false },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { searchName, queryJsonb, alertOnMatch = false } =
        request.body as { searchName: string; queryJsonb: Record<string, unknown>; alertOnMatch?: boolean };
      const { userId } = request.authUser!;

      const result = await query(
        `INSERT INTO saved_search (search_name, query_jsonb, alert_on_match, created_by)
         VALUES ($1, $2, $3, $4)
         RETURNING search_id, search_name, query_jsonb, alert_on_match,
                   last_run_at, result_count, is_active, created_by, created_at, updated_at`,
        [searchName, JSON.stringify(queryJsonb), alertOnMatch, userId],
      );
      reply.code(201);
      return { savedSearch: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to create saved search");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  /**
   * PUT /api/v1/saved-searches/:id
   * Update an existing saved search owned by the current user.
   */
  app.put("/api/v1/saved-searches/:id", {
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
        properties: {
          searchName: { type: "string", minLength: 1, maxLength: 200 },
          queryJsonb: { type: "object", additionalProperties: true },
          alertOnMatch: { type: "boolean" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { userId } = request.authUser!;
      const body = request.body as { searchName?: string; queryJsonb?: Record<string, unknown>; alertOnMatch?: boolean };

      const sets: string[] = [];
      const params: unknown[] = [];
      let idx = 1;

      if (body.searchName !== undefined) { sets.push(`search_name = $${idx++}`); params.push(body.searchName); }
      if (body.queryJsonb !== undefined) { sets.push(`query_jsonb = $${idx++}`); params.push(JSON.stringify(body.queryJsonb)); }
      if (body.alertOnMatch !== undefined) { sets.push(`alert_on_match = $${idx++}`); params.push(body.alertOnMatch); }

      if (sets.length === 0) {
        return send400(reply, "NO_FIELDS", "No fields to update");
      }

      sets.push(`updated_at = NOW()`);
      params.push(id, userId);

      const result = await query(
        `UPDATE saved_search SET ${sets.join(", ")}
         WHERE search_id = $${idx++} AND created_by = $${idx} AND is_active = TRUE
         RETURNING search_id, search_name, query_jsonb, alert_on_match, is_active, updated_at`,
        params,
      );
      if (result.rows.length === 0) {
        return send404(reply, "SAVED_SEARCH_NOT_FOUND", "Saved search not found");
      }
      return { savedSearch: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to update saved search");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  /**
   * DELETE /api/v1/saved-searches/:id
   * Soft-delete a saved search by setting is_active = false.
   */
  app.delete("/api/v1/saved-searches/:id", {
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

      const result = await query(
        `UPDATE saved_search
         SET is_active = FALSE, updated_at = NOW()
         WHERE search_id = $1 AND created_by = $2 AND is_active = TRUE
         RETURNING search_id`,
        [id, userId],
      );
      if (result.rows.length === 0) {
        return send404(reply, "SAVED_SEARCH_NOT_FOUND", "Saved search not found");
      }
      return { success: true, searchId: id };
    } catch (err: unknown) {
      request.log.error(err, "Failed to delete saved search");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  /**
   * POST /api/v1/saved-searches/:id/run
   * Execute the stored query_jsonb against content_item and return matching results.
   * Supported query fields: platform, keywords (array), min_threat_score, published_after, published_before.
   */
  app.post("/api/v1/saved-searches/:id/run", {
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
      const { userId } = request.authUser!;

      // Load saved search
      const ssResult = await query(
        `SELECT search_id, query_jsonb FROM saved_search
         WHERE search_id = $1 AND created_by = $2 AND is_active = TRUE`,
        [id, userId],
      );
      if (ssResult.rows.length === 0) {
        return send404(reply, "SAVED_SEARCH_NOT_FOUND", "Saved search not found");
      }

      const queryDef = ssResult.rows[0].query_jsonb as Record<string, unknown>;

      // Build a parameterized WHERE clause from the stored query definition
      const conditions: string[] = [];
      const params: unknown[] = [];
      let idx = 1;

      const platform = queryDef.platform as string | undefined;
      if (platform) {
        conditions.push(`ci.platform = $${idx++}`);
        params.push(platform);
      }

      const minThreatScore = queryDef.min_threat_score as number | undefined;
      if (typeof minThreatScore === "number") {
        conditions.push(`ci.threat_score >= $${idx++}`);
        params.push(minThreatScore);
      }

      const publishedAfter = queryDef.published_after as string | undefined;
      if (publishedAfter) {
        conditions.push(`ci.published_at >= $${idx++}`);
        params.push(publishedAfter);
      }

      const publishedBefore = queryDef.published_before as string | undefined;
      if (publishedBefore) {
        conditions.push(`ci.published_at <= $${idx++}`);
        params.push(publishedBefore);
      }

      const keywords = queryDef.keywords as string[] | undefined;
      if (keywords && keywords.length > 0) {
        // Any keyword match using ILIKE
        const keywordClauses = keywords.map(() => `ci.content_text ILIKE '%' || $${idx++} || '%'`);
        params.push(...keywords);
        conditions.push(`(${keywordClauses.join(" OR ")})`);
      }

      const categoryId = queryDef.category_id as string | undefined;
      if (categoryId) {
        conditions.push(`ci.category_id = $${idx++}::uuid`);
        params.push(categoryId);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      params.push(limit, offset);

      const contentResult = await query(
        `SELECT ci.content_id, ci.platform, ci.author_handle, ci.author_name,
                ci.content_text, ci.content_url, ci.language, ci.sentiment,
                ci.threat_score, ci.published_at, ci.ingested_at,
                COUNT(*) OVER() AS total_count
         FROM content_item ci
         ${whereClause}
         ORDER BY ci.threat_score DESC, ci.published_at DESC
         LIMIT $${idx++} OFFSET $${idx}`,
        params,
      );

      const total = contentResult.rows.length > 0 ? parseInt(contentResult.rows[0].total_count, 10) : 0;

      // Update last_run_at and result_count on the saved search
      await query(
        `UPDATE saved_search SET last_run_at = NOW(), result_count = $1 WHERE search_id = $2`,
        [total, id],
      );

      return {
        searchId: id,
        results: contentResult.rows.map(({ total_count, ...r }) => r),
        total,
      };
    } catch (err: unknown) {
      request.log.error(err, "Failed to run saved search");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });
}
