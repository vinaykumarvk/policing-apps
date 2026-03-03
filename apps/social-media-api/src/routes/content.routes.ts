import { FastifyInstance } from "fastify";
import { query } from "../db";
import { send404 } from "../errors";

export async function registerContentRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/content", async () => {
    const result = await query(
      `SELECT content_id, platform, author_handle, author_name, content_text, content_url,
              language, sentiment, category_id, threat_score, published_at, ingested_at
       FROM content_item ORDER BY ingested_at DESC LIMIT 100`,
    );
    return { content: result.rows, total: result.rows.length };
  });

  app.get("/api/v1/content/:id", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
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
  });
}
