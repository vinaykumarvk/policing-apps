import { FastifyInstance } from "fastify";
import { query } from "../db";
import { sendError, send400, send404 } from "../errors";

export async function registerTaxonomyRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/v1/taxonomy/versions — List taxonomy versions
  app.get("/api/v1/taxonomy/versions", {
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
      const { limit: rawLimit, offset: rawOffset } = request.query as Record<string, string | undefined>;
      const limit = Math.min(parseInt(rawLimit || "50", 10) || 50, 200);
      const offset = Math.max(parseInt(rawOffset || "0", 10) || 0, 0);
      const result = await query(
        `SELECT tv.version_id, tv.version_no, tv.is_active, tv.description, tv.created_by,
                tv.created_at, tv.activated_at,
                (SELECT COUNT(*)::int FROM taxonomy_rule tr WHERE tr.version_id = tv.version_id) AS rule_count,
                COUNT(*) OVER() AS total_count
         FROM taxonomy_version tv
         ORDER BY tv.version_no DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset],
      );
      const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
      return { versions: result.rows.map(({ total_count, ...r }) => r), total };
    } catch (err: unknown) {
      request.log.error(err, "Failed to list taxonomy versions");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // GET /api/v1/taxonomy/versions/:id — Get a single taxonomy version with its rules
  app.get("/api/v1/taxonomy/versions/:id", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const versionResult = await query(
        `SELECT version_id, version_no, is_active, description, created_by, created_at, activated_at
         FROM taxonomy_version WHERE version_id = $1`,
        [id],
      );
      if (versionResult.rows.length === 0) {
        return send404(reply, "VERSION_NOT_FOUND", "Taxonomy version not found");
      }
      const rulesResult = await query(
        `SELECT rule_id, category, pattern, threshold, risk_weight, is_active, created_at, updated_at
         FROM taxonomy_rule WHERE version_id = $1 ORDER BY category, created_at`,
        [id],
      );
      return { version: versionResult.rows[0], rules: rulesResult.rows };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get taxonomy version");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // POST /api/v1/taxonomy/versions — Create a new taxonomy version (copies rules from current active)
  app.post("/api/v1/taxonomy/versions", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        properties: {
          description: { type: "string" },
          copyFromVersionId: { type: "string", format: "uuid" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { description, copyFromVersionId } = request.body as { description?: string; copyFromVersionId?: string };
      const { userId } = request.authUser!;

      // Get next version number
      const maxResult = await query(`SELECT COALESCE(MAX(version_no), 0) + 1 AS next_no FROM taxonomy_version`);
      const nextNo = maxResult.rows[0].next_no;

      // Create the new version
      const versionResult = await query(
        `INSERT INTO taxonomy_version (version_no, description, created_by)
         VALUES ($1, $2, $3)
         RETURNING version_id, version_no, is_active, description, created_by, created_at`,
        [nextNo, description || `Version ${nextNo}`, userId],
      );
      const newVersionId = versionResult.rows[0].version_id;

      // Copy rules from source version (active version or specified version)
      let sourceVersionId = copyFromVersionId;
      if (!sourceVersionId) {
        const activeResult = await query(`SELECT version_id FROM taxonomy_version WHERE is_active = TRUE LIMIT 1`);
        if (activeResult.rows.length > 0) {
          sourceVersionId = activeResult.rows[0].version_id;
        }
      }

      let copiedCount = 0;
      if (sourceVersionId) {
        const copyResult = await query(
          `INSERT INTO taxonomy_rule (version_id, category, pattern, threshold, risk_weight, is_active)
           SELECT $1, category, pattern, threshold, risk_weight, is_active
           FROM taxonomy_rule WHERE version_id = $2
           RETURNING rule_id`,
          [newVersionId, sourceVersionId],
        );
        copiedCount = copyResult.rowCount || 0;
      }

      reply.code(201);
      return { version: versionResult.rows[0], copiedRules: copiedCount };
    } catch (err: unknown) {
      request.log.error(err, "Failed to create taxonomy version");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // POST /api/v1/taxonomy/versions/:id/activate — Activate a taxonomy version (deactivates others)
  app.post("/api/v1/taxonomy/versions/:id/activate", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      // Verify version exists
      const versionCheck = await query(`SELECT version_id FROM taxonomy_version WHERE version_id = $1`, [id]);
      if (versionCheck.rows.length === 0) {
        return send404(reply, "VERSION_NOT_FOUND", "Taxonomy version not found");
      }

      // Deactivate all versions, then activate the target
      await query(`UPDATE taxonomy_version SET is_active = FALSE WHERE is_active = TRUE`);
      const result = await query(
        `UPDATE taxonomy_version SET is_active = TRUE, activated_at = NOW() WHERE version_id = $1
         RETURNING version_id, version_no, is_active, activated_at`,
        [id],
      );
      return { version: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to activate taxonomy version");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // ── Taxonomy Rules CRUD ──

  // POST /api/v1/taxonomy/rules — Add a rule to a version
  app.post("/api/v1/taxonomy/rules", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["versionId", "category", "pattern"],
        properties: {
          versionId: { type: "string", format: "uuid" },
          category: { type: "string", maxLength: 128 },
          pattern: { type: "string" },
          threshold: { type: "number", minimum: 0, maximum: 1 },
          riskWeight: { type: "number", minimum: 0 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { versionId, category, pattern, threshold, riskWeight } = request.body as {
        versionId: string; category: string; pattern: string; threshold?: number; riskWeight?: number;
      };

      // Verify version exists
      const vCheck = await query(`SELECT version_id, is_active FROM taxonomy_version WHERE version_id = $1`, [versionId]);
      if (vCheck.rows.length === 0) {
        return send404(reply, "VERSION_NOT_FOUND", "Taxonomy version not found");
      }
      if (vCheck.rows[0].is_active) {
        return send400(reply, "VERSION_ACTIVE", "Cannot add rules to the active version. Create a new version first.");
      }

      const result = await query(
        `INSERT INTO taxonomy_rule (version_id, category, pattern, threshold, risk_weight)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING rule_id, version_id, category, pattern, threshold, risk_weight, is_active, created_at`,
        [versionId, category, pattern, threshold ?? 0.5, riskWeight ?? 1.0],
      );
      reply.code(201);
      return { rule: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to create taxonomy rule");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // PATCH /api/v1/taxonomy/rules/:ruleId — Update a rule
  app.patch("/api/v1/taxonomy/rules/:ruleId", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["ruleId"], properties: { ruleId: { type: "string", format: "uuid" } } },
      body: {
        type: "object",
        additionalProperties: false,
        properties: {
          category: { type: "string", maxLength: 128 },
          pattern: { type: "string" },
          threshold: { type: "number", minimum: 0, maximum: 1 },
          riskWeight: { type: "number", minimum: 0 },
          isActive: { type: "boolean" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { ruleId } = request.params as { ruleId: string };
      const { category, pattern, threshold, riskWeight, isActive } = request.body as {
        category?: string; pattern?: string; threshold?: number; riskWeight?: number; isActive?: boolean;
      };

      // Build dynamic update
      const sets: string[] = [];
      const params: any[] = [];
      let idx = 1;

      if (category !== undefined) { sets.push(`category = $${idx++}`); params.push(category); }
      if (pattern !== undefined) { sets.push(`pattern = $${idx++}`); params.push(pattern); }
      if (threshold !== undefined) { sets.push(`threshold = $${idx++}`); params.push(threshold); }
      if (riskWeight !== undefined) { sets.push(`risk_weight = $${idx++}`); params.push(riskWeight); }
      if (isActive !== undefined) { sets.push(`is_active = $${idx++}`); params.push(isActive); }

      if (sets.length === 0) {
        return send400(reply, "NO_FIELDS", "No fields to update");
      }

      sets.push(`updated_at = NOW()`);
      params.push(ruleId);

      const result = await query(
        `UPDATE taxonomy_rule SET ${sets.join(", ")} WHERE rule_id = $${idx}
         RETURNING rule_id, version_id, category, pattern, threshold, risk_weight, is_active, updated_at`,
        params,
      );
      if (result.rows.length === 0) {
        return send404(reply, "RULE_NOT_FOUND", "Taxonomy rule not found");
      }
      return { rule: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to update taxonomy rule");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // DELETE /api/v1/taxonomy/rules/:ruleId — Delete (deactivate) a rule
  app.delete("/api/v1/taxonomy/rules/:ruleId", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["ruleId"], properties: { ruleId: { type: "string", format: "uuid" } } },
    },
  }, async (request, reply) => {
    try {
      const { ruleId } = request.params as { ruleId: string };
      const result = await query(
        `UPDATE taxonomy_rule SET is_active = FALSE, updated_at = NOW() WHERE rule_id = $1 RETURNING rule_id`,
        [ruleId],
      );
      if (result.rows.length === 0) {
        return send404(reply, "RULE_NOT_FOUND", "Taxonomy rule not found");
      }
      return { success: true };
    } catch (err: unknown) {
      request.log.error(err, "Failed to delete taxonomy rule");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });
}
