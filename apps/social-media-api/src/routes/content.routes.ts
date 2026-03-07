import { FastifyInstance } from "fastify";
import { query } from "../db";
import { sendError, send400, send404 } from "../errors";
import { createRoleGuard } from "@puda/api-core";

const requireAnalyst = createRoleGuard(["ANALYST", "SUPERVISOR", "PLATFORM_ADMINISTRATOR"]);

export async function registerContentRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/content", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          platform: { type: "string", maxLength: 100 },
          category_id: { type: "string", maxLength: 100 },
          retention_expired: { type: "string", maxLength: 10 },
          limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
          offset: { type: "integer", minimum: 0, default: 0 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { platform, category_id, retention_expired, limit: rawLimit, offset: rawOffset } = request.query as Record<string, string | undefined>;
      const limit = Math.min(Math.max(parseInt(rawLimit || "50", 10) || 50, 1), 200);
      const offset = Math.max(parseInt(rawOffset || "0", 10) || 0, 0);
      const retentionFilter = retention_expired === "true";
      const result = await query(
        `SELECT ci.content_id, ci.platform, ci.author_handle, ci.author_name, ci.content_text, ci.content_url,
                ci.language, ci.sentiment, ci.category_id, tc.name AS category_name, ci.threat_score,
                ci.legal_basis, ci.retention_until, ci.retention_flagged,
                ci.published_at, ci.ingested_at,
                COUNT(*) OVER() AS total_count
         FROM content_item ci
         LEFT JOIN taxonomy_category tc ON tc.category_id = ci.category_id
         WHERE ($1::text IS NULL OR ci.platform = $1)
           AND ($2::uuid IS NULL OR ci.category_id = $2::uuid)
           AND ($3::boolean = FALSE OR (ci.retention_until IS NOT NULL AND ci.retention_until < NOW()))
         ORDER BY ci.ingested_at DESC
         LIMIT $4 OFFSET $5`,
        [platform || null, category_id || null, retentionFilter, limit, offset],
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

  // FR-03: POST /api/v1/content/ingest — Ingest content with legal basis and retention (ANALYST+)
  app.post("/api/v1/content/ingest", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["platform", "contentText", "legalBasis"],
        properties: {
          platform: { type: "string", maxLength: 64 },
          platformPostId: { type: "string", maxLength: 256 },
          authorHandle: { type: "string", maxLength: 256 },
          authorName: { type: "string", maxLength: 256 },
          contentText: { type: "string" },
          contentUrl: { type: "string" },
          language: { type: "string", maxLength: 8 },
          legalBasis: { type: "string", enum: ["COURT_ORDER", "INVESTIGATION", "PUBLIC_INTEREST", "REGULATORY", "CONSENT", "NATIONAL_SECURITY"] },
          retentionDays: { type: "integer", minimum: 1 },
          connectorId: { type: "string", format: "uuid" },
          metadataJsonb: { type: "object" },
        },
      },
    },
  }, async (request, reply) => {
    if (!requireAnalyst(request, reply)) return;
    try {
      const body = request.body as {
        platform: string; platformPostId?: string; authorHandle?: string; authorName?: string;
        contentText: string; contentUrl?: string; language?: string;
        legalBasis: string; retentionDays?: number; connectorId?: string; metadataJsonb?: Record<string, unknown>;
      };

      // Calculate retention_until
      let retentionDays = body.retentionDays || 365;
      if (body.connectorId && !body.retentionDays) {
        const connResult = await query(
          `SELECT default_retention_days FROM source_connector WHERE connector_id = $1`,
          [body.connectorId],
        );
        if (connResult.rows.length > 0 && connResult.rows[0].default_retention_days) {
          retentionDays = connResult.rows[0].default_retention_days;
        }
      }
      const retentionUntil = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);

      const result = await query(
        `INSERT INTO content_item (connector_id, platform, platform_post_id, author_handle, author_name,
                content_text, content_url, language, legal_basis, retention_until, metadata_jsonb)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING content_id, platform, author_handle, content_url, legal_basis, retention_until, ingested_at`,
        [
          body.connectorId || null, body.platform, body.platformPostId || null,
          body.authorHandle || null, body.authorName || null,
          body.contentText, body.contentUrl || null, body.language || null,
          body.legalBasis, retentionUntil, JSON.stringify(body.metadataJsonb || {}),
        ],
      );
      reply.code(201);
      return { content: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to ingest content");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
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
