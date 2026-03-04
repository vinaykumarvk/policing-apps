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
        `SELECT ci.content_id, ci.platform, ci.author_handle, ci.author_name, ci.content_text, ci.content_url,
                ci.language, ci.sentiment, ci.category_id, tc.name AS category_name, ci.threat_score, ci.published_at, ci.ingested_at,
                COUNT(*) OVER() AS total_count
         FROM content_item ci
         LEFT JOIN taxonomy_category tc ON tc.category_id = ci.category_id
         WHERE ($1::text IS NULL OR ci.platform = $1)
           AND ($2::uuid IS NULL OR ci.category_id = $2::uuid)
         ORDER BY ci.ingested_at DESC
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

  app.get("/api/v1/content/facets", async () => {
    const [platformRows, categoryRows] = await Promise.all([
      query(`SELECT platform AS value, COUNT(*)::int AS count FROM content_item GROUP BY platform ORDER BY count DESC`, []),
      query(`SELECT ci.category_id AS value, tc.name AS label, COUNT(*)::int AS count FROM content_item ci LEFT JOIN taxonomy_category tc ON tc.category_id = ci.category_id WHERE ci.category_id IS NOT NULL GROUP BY ci.category_id, tc.name ORDER BY count DESC`, []),
    ]);
    return { facets: { platform: platformRows.rows, category_id: categoryRows.rows } };
  });

  app.get("/api/v1/content/:id", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const result = await query(
        `SELECT ci.content_id, ci.connector_id, ci.platform, ci.platform_post_id, ci.author_handle, ci.author_name,
                ci.content_text, ci.content_url, ci.language, ci.sentiment, ci.category_id, tc.name AS category_name,
                ci.threat_score, ci.metadata_jsonb, ci.published_at, ci.ingested_at, ci.created_at
         FROM content_item ci
         LEFT JOIN taxonomy_category tc ON tc.category_id = ci.category_id
         WHERE ci.content_id = $1`,
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
