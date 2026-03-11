import { FastifyInstance } from "fastify";
import { query } from "../db";
import { send400, send404, sendError } from "../errors";

export async function registerTaxonomyRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/v1/taxonomy — List categories (tree structure)
  app.get("/api/v1/taxonomy", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          parent_id: { type: "string", format: "uuid" },
          flat: { type: "string", maxLength: 10 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { parent_id, flat } = request.query as Record<string, string | undefined>;

      if (flat === "true") {
        const result = await query(
          `SELECT category_id, category_name, parent_id, level, path, is_active, created_at
           FROM taxonomy_category WHERE is_active = TRUE ORDER BY path, category_name`,
        );
        return { categories: result.rows };
      }

      // Tree: return only requested level
      const result = await query(
        `SELECT category_id, category_name, parent_id, level, path, is_active, created_at
         FROM taxonomy_category
         WHERE ($1::uuid IS NULL AND parent_id IS NULL OR parent_id = $1)
           AND is_active = TRUE
         ORDER BY category_name`,
        [parent_id || null],
      );
      return { categories: result.rows };
    } catch (err) {
      request.log.error(err, "Failed to list taxonomy categories");
      reply.code(500).send({ error: "INTERNAL_ERROR", message: "Failed to list taxonomy categories" });
    }
  });

  // POST /api/v1/taxonomy — Create category
  app.post("/api/v1/taxonomy", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["categoryName"],
        properties: {
          categoryName: { type: "string" },
          parentId: { type: "string", format: "uuid" },
          description: { type: "string" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { categoryName, parentId, description } = request.body as {
        categoryName: string; parentId?: string; description?: string;
      };

      let level = 0;
      let path = `/${categoryName.toLowerCase().replace(/\s+/g, "-")}`;

      if (parentId) {
        const parent = await query(`SELECT level, path FROM taxonomy_category WHERE category_id = $1`, [parentId]);
        if (parent.rows.length === 0) return send404(reply, "PARENT_NOT_FOUND", "Parent category not found");
        level = parent.rows[0].level + 1;
        path = `${parent.rows[0].path}/${categoryName.toLowerCase().replace(/\s+/g, "-")}`;
      }

      const result = await query(
        `INSERT INTO taxonomy_category (category_name, parent_id, level, path, description)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING category_id, category_name, parent_id, level, path, created_at`,
        [categoryName, parentId || null, level, path, description || null],
      );
      reply.code(201);
      return { category: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to create taxonomy category");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // --- Classification Thresholds ---

  app.get("/api/v1/classification-thresholds", async (request, reply) => {
    try {
      const result = await query(
        `SELECT t.threshold_id, t.category_id, c.category_name, t.min_score, t.max_score, t.action, t.is_active
         FROM classification_threshold t
         LEFT JOIN taxonomy_category c ON t.category_id = c.category_id
         WHERE t.is_active = TRUE
         ORDER BY c.category_name, t.min_score`,
      );
      return { thresholds: result.rows };
    } catch (err) {
      request.log.error(err, "Failed to list classification thresholds");
      reply.code(500).send({ error: "INTERNAL_ERROR", message: "Failed to list classification thresholds" });
    }
  });

  app.post("/api/v1/classification-thresholds", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["minScore", "maxScore", "action"],
        properties: {
          categoryId: { type: "string", format: "uuid" },
          minScore: { type: "number", minimum: 0, maximum: 100 },
          maxScore: { type: "number", minimum: 0, maximum: 100 },
          action: { type: "string", enum: ["AUTO_ACCEPT", "NEEDS_REVIEW", "AUTO_REJECT"] },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { categoryId, minScore, maxScore, action } = request.body as {
        categoryId?: string; minScore: number; maxScore: number; action: string;
      };
      if (minScore >= maxScore) return send400(reply, "INVALID_RANGE", "minScore must be less than maxScore");

      const result = await query(
        `INSERT INTO classification_threshold (category_id, min_score, max_score, action)
         VALUES ($1, $2, $3, $4)
         RETURNING threshold_id, category_id, min_score, max_score, action, created_at`,
        [categoryId || null, minScore, maxScore, action],
      );
      reply.code(201);
      return { threshold: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to create threshold");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });
}
