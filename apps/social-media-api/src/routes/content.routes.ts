import { FastifyInstance } from "fastify";
import { query } from "../db";
import { sendError, send404 } from "../errors";

export async function registerContentRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/content", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          platform: { type: "string", maxLength: 100 },
          category_id: { type: "string", maxLength: 100 },
          limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
          offset: { type: "integer", minimum: 0, default: 0 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { platform, category_id, limit: rawLimit, offset: rawOffset } = request.query as Record<string, string | undefined>;
      const limit = Math.min(Math.max(parseInt(rawLimit || "50", 10) || 50, 1), 200);
      const offset = Math.max(parseInt(rawOffset || "0", 10) || 0, 0);
      const result = await query(
        `SELECT content_id, platform, author_handle, author_name, content_text, content_url,
                language, sentiment, category_id, threat_score, published_at, ingested_at,
                COUNT(*) OVER() AS total_count
         FROM content_item
         WHERE ($1::text IS NULL OR platform = $1)
           AND ($2::text IS NULL OR category_id = $2)
         ORDER BY ingested_at DESC
         LIMIT $3 OFFSET $4`,
        [platform || null, category_id || null, limit, offset],
      );
      const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
      return { content: result.rows.map(({ total_count, ...r }) => r), total };
    } catch (err: unknown) {
      request.log.error(err, "Failed to list content");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  app.get("/api/v1/content/:id", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const result = await query(
        `SELECT content_id, connector_id, platform, platform_post_id, author_handle, author_name,
                content_text, content_url, language, sentiment, category_id, threat_score,
                metadata_jsonb, published_at, ingested_at, created_at
         FROM content_item WHERE content_id = $1`,
        [id],
      );
      if (result.rows.length === 0) {
        return send404(reply, "CONTENT_NOT_FOUND", "Content item not found");
      }
      return { content: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get content item");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });
}
