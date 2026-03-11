import { FastifyInstance } from "fastify";
import { suggestStatutes, autoMapEntity, getMappings, confirmMapping, addManualMapping, getStatutes, reviewMapping, getPendingMappings } from "../services/legal-mapper";
import { evaluateRulesForEntity, testRuleExpression } from "../services/legal-rule-evaluator";
import { query } from "../db";
import { sendError, send404 } from "../errors";
import { resolveEntityTable } from "../services/entity-resolver";

export async function registerLegalRoutes(app: FastifyInstance): Promise<void> {
  // Get all statutes (with optional search)
  app.get("/api/v1/legal/sections", async (request, reply) => {
    try {
      const { q } = request.query as { q?: string };
      const statutes = await getStatutes(q);
      return { statutes };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get legal sections");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Suggest statutes based on free text
  app.post("/api/v1/legal/suggest", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["text"],
        properties: {
          text: { type: "string" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { text } = request.body as { text: string };
      if (!text) {
        return { suggestions: [] };
      }
      const suggestions = await suggestStatutes(text);
      return { suggestions };
    } catch (err: unknown) {
      request.log.error(err, "Failed to suggest statutes");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Auto-map entity to legal sections
  app.post("/api/v1/legal/map", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["entityType", "entityId"],
        properties: {
          entityType: { type: "string" },
          entityId: { type: "string", format: "uuid" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { entityType, entityId } = request.body as { entityType: string; entityId: string };
      if (!entityType || !entityId) {
        return sendError(reply, 400, "VALIDATION_ERROR", "entityType and entityId are required");
      }

      let resolved;
      try {
        resolved = resolveEntityTable(entityType);
      } catch {
        return sendError(reply, 400, "UNKNOWN_ENTITY_TYPE", `Unknown entity type: ${entityType}`);
      }
      const { table: tableName, idCol: idColumn } = resolved;
      // Legal mapping uses 'summary' for leads (more suitable for statute analysis)
      const textColumn = entityType === "dopams_lead" ? "summary" : resolved.textCol;

      const entityResult = await query(`SELECT ${textColumn} FROM ${tableName} WHERE ${idColumn} = $1`, [entityId]);
      if (entityResult.rows.length === 0) {
        return send404(reply, "NOT_FOUND", "Entity not found");
      }

      const text = entityResult.rows[0][textColumn] || "";
      const mappings = await autoMapEntity(entityType, entityId, text);
      return { mappings };
    } catch (err: unknown) {
      request.log.error(err, "Failed to auto-map entity to legal sections");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Get mappings for an entity
  app.get("/api/v1/legal/mappings/:entityType/:entityId", async (request, reply) => {
    try {
      const { entityType, entityId } = request.params as { entityType: string; entityId: string };
      const mappings = await getMappings(entityType, entityId);
      return { mappings };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get legal mappings");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Confirm a mapping
  app.patch("/api/v1/legal/mappings/:mappingId/confirm", async (request, reply) => {
    try {
      const { mappingId } = request.params as { mappingId: string };
      const userId = request.authUser!.userId;
      const result = await confirmMapping(mappingId, userId);
      if (!result) return send404(reply, "NOT_FOUND", "Mapping not found");
      return result;
    } catch (err: unknown) {
      request.log.error(err, "Failed to confirm legal mapping");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Add manual mapping
  app.post("/api/v1/legal/mappings", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["entityType", "entityId", "statuteId"],
        properties: {
          entityType: { type: "string" },
          entityId: { type: "string", format: "uuid" },
          statuteId: { type: "string", format: "uuid" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { entityType, entityId, statuteId } = request.body as { entityType: string; entityId: string; statuteId: string };
      if (!entityType || !entityId || !statuteId) {
        return sendError(reply, 400, "VALIDATION_ERROR", "entityType, entityId, and statuteId are required");
      }
      const userId = request.authUser!.userId;
      const result = await addManualMapping(entityType, entityId, statuteId, userId);
      reply.code(201);
      return result;
    } catch (err: unknown) {
      request.log.error(err, "Failed to add manual legal mapping");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // RULE CRUD + LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════

  // GET /api/v1/legal/rules — List rules
  app.get("/api/v1/legal/rules", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          status: { type: "string", maxLength: 30 },
          law_name: { type: "string", maxLength: 200 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { status, law_name } = request.query as { status?: string; law_name?: string };
      let sql = "SELECT * FROM legal_mapping_rule WHERE 1=1";
      const params: unknown[] = [];

      if (status) {
        params.push(status);
        sql += ` AND approval_status = $${params.length}`;
      }
      if (law_name) {
        params.push(law_name);
        sql += ` AND law_name = $${params.length}`;
      }
      sql += " ORDER BY severity_weight DESC, rule_code";

      const result = await query(sql, params);
      return { rules: result.rows };
    } catch (err: unknown) {
      request.log.error(err, "Failed to list rules");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // GET /api/v1/legal/rules/:ruleId — Get single rule
  app.get("/api/v1/legal/rules/:ruleId", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["ruleId"], properties: { ruleId: { type: "string", format: "uuid" } } },
    },
  }, async (request, reply) => {
    try {
      const { ruleId } = request.params as { ruleId: string };
      const result = await query("SELECT * FROM legal_mapping_rule WHERE rule_id = $1", [ruleId]);
      if (result.rows.length === 0) return send404(reply, "NOT_FOUND", "Rule not found");
      return { rule: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get rule");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // POST /api/v1/legal/rules — Create DRAFT rule
  app.post("/api/v1/legal/rules", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["rule_code", "law_name", "provision_code", "rule_expression"],
        properties: {
          rule_code: { type: "string" },
          law_name: { type: "string" },
          provision_code: { type: "string" },
          rule_expression: { type: "object" },
          severity_weight: { type: "number" },
          effective_from: { type: "string" },
          effective_to: { type: "string" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const userId = request.authUser!.userId;
      const result = await query(
        `INSERT INTO legal_mapping_rule
           (rule_code, law_name, provision_code, rule_expression, severity_weight,
            effective_from, effective_to, created_by, approval_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'DRAFT') RETURNING *`,
        [
          body.rule_code, body.law_name, body.provision_code,
          JSON.stringify(body.rule_expression),
          body.severity_weight || 1.0,
          body.effective_from || null, body.effective_to || null,
          userId,
        ],
      );
      reply.code(201);
      return { rule: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to create rule");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // PUT /api/v1/legal/rules/:ruleId — Update DRAFT rule
  app.put("/api/v1/legal/rules/:ruleId", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["ruleId"], properties: { ruleId: { type: "string", format: "uuid" } } },
      body: {
        type: "object",
        additionalProperties: false,
        properties: {
          law_name: { type: "string" },
          provision_code: { type: "string" },
          rule_expression: { type: "object" },
          severity_weight: { type: "number" },
          effective_from: { type: "string" },
          effective_to: { type: "string" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { ruleId } = request.params as { ruleId: string };
      const body = request.body as Record<string, unknown>;

      const existing = await query(
        "SELECT approval_status FROM legal_mapping_rule WHERE rule_id = $1", [ruleId],
      );
      if (existing.rows.length === 0) return send404(reply, "NOT_FOUND", "Rule not found");
      if (existing.rows[0].approval_status !== "DRAFT") {
        return sendError(reply, 400, "INVALID_STATUS", "Only DRAFT rules can be edited");
      }

      const result = await query(
        `UPDATE legal_mapping_rule SET
           law_name = COALESCE($2, law_name),
           provision_code = COALESCE($3, provision_code),
           rule_expression = COALESCE($4::jsonb, rule_expression),
           severity_weight = COALESCE($5, severity_weight),
           effective_from = COALESCE($6::timestamptz, effective_from),
           effective_to = COALESCE($7::timestamptz, effective_to),
           updated_at = NOW()
         WHERE rule_id = $1 RETURNING *`,
        [
          ruleId,
          body.law_name || null, body.provision_code || null,
          body.rule_expression ? JSON.stringify(body.rule_expression) : null,
          body.severity_weight || null,
          body.effective_from || null, body.effective_to || null,
        ],
      );
      return { rule: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to update rule");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // PATCH /api/v1/legal/rules/:ruleId/submit — Submit: DRAFT -> PENDING_REVIEW
  app.patch("/api/v1/legal/rules/:ruleId/submit", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["ruleId"], properties: { ruleId: { type: "string", format: "uuid" } } },
    },
  }, async (request, reply) => {
    try {
      const { ruleId } = request.params as { ruleId: string };
      const result = await query(
        `UPDATE legal_mapping_rule SET approval_status = 'PENDING_REVIEW', updated_at = NOW()
         WHERE rule_id = $1 AND approval_status = 'DRAFT' RETURNING *`,
        [ruleId],
      );
      if (result.rows.length === 0) return sendError(reply, 400, "INVALID_TRANSITION", "Rule must be in DRAFT status");
      return { rule: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to submit rule");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // PATCH /api/v1/legal/rules/:ruleId/approve — Approve: PENDING_REVIEW -> APPROVED (four-eyes)
  app.patch("/api/v1/legal/rules/:ruleId/approve", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["ruleId"], properties: { ruleId: { type: "string", format: "uuid" } } },
    },
  }, async (request, reply) => {
    try {
      const { ruleId } = request.params as { ruleId: string };
      const userId = request.authUser!.userId;

      const existing = await query("SELECT created_by, approval_status FROM legal_mapping_rule WHERE rule_id = $1", [ruleId]);
      if (existing.rows.length === 0) return send404(reply, "NOT_FOUND", "Rule not found");
      if (existing.rows[0].approval_status !== "PENDING_REVIEW") {
        return sendError(reply, 400, "INVALID_TRANSITION", "Rule must be in PENDING_REVIEW status");
      }
      if (existing.rows[0].created_by === userId) {
        return sendError(reply, 403, "FOUR_EYES_VIOLATION", "Approver must be different from creator");
      }

      const result = await query(
        `UPDATE legal_mapping_rule SET approval_status = 'APPROVED', approved_by = $2, approved_at = NOW(), updated_at = NOW()
         WHERE rule_id = $1 RETURNING *`,
        [ruleId, userId],
      );
      return { rule: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to approve rule");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // PATCH /api/v1/legal/rules/:ruleId/reject — Reject: PENDING_REVIEW -> REJECTED
  app.patch("/api/v1/legal/rules/:ruleId/reject", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["ruleId"], properties: { ruleId: { type: "string", format: "uuid" } } },
      body: {
        type: "object",
        additionalProperties: false,
        properties: { reason: { type: "string" } },
      },
    },
  }, async (request, reply) => {
    try {
      const { ruleId } = request.params as { ruleId: string };
      const result = await query(
        `UPDATE legal_mapping_rule SET approval_status = 'REJECTED', updated_at = NOW()
         WHERE rule_id = $1 AND approval_status = 'PENDING_REVIEW' RETURNING *`,
        [ruleId],
      );
      if (result.rows.length === 0) return sendError(reply, 400, "INVALID_TRANSITION", "Rule must be in PENDING_REVIEW status");
      return { rule: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to reject rule");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // PATCH /api/v1/legal/rules/:ruleId/publish — Publish: APPROVED -> PUBLISHED
  app.patch("/api/v1/legal/rules/:ruleId/publish", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["ruleId"], properties: { ruleId: { type: "string", format: "uuid" } } },
    },
  }, async (request, reply) => {
    try {
      const { ruleId } = request.params as { ruleId: string };
      const existing = await query(
        "SELECT rule_code, approval_status FROM legal_mapping_rule WHERE rule_id = $1", [ruleId],
      );
      if (existing.rows.length === 0) return send404(reply, "NOT_FOUND", "Rule not found");
      if (existing.rows[0].approval_status !== "APPROVED") {
        return sendError(reply, 400, "INVALID_TRANSITION", "Rule must be in APPROVED status");
      }

      // Supersede any existing PUBLISHED version with same rule_code
      await query(
        `UPDATE legal_mapping_rule SET approval_status = 'SUPERSEDED', updated_at = NOW()
         WHERE rule_code = $1 AND approval_status = 'PUBLISHED' AND rule_id != $2`,
        [existing.rows[0].rule_code, ruleId],
      );

      const result = await query(
        `UPDATE legal_mapping_rule SET approval_status = 'PUBLISHED', effective_from = COALESCE(effective_from, NOW()), updated_at = NOW()
         WHERE rule_id = $1 RETURNING *`,
        [ruleId],
      );
      return { rule: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to publish rule");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // POST /api/v1/legal/rules/:ruleId/rollback — Rollback: PUBLISHED -> ROLLED_BACK
  app.post("/api/v1/legal/rules/:ruleId/rollback", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["ruleId"], properties: { ruleId: { type: "string", format: "uuid" } } },
    },
  }, async (request, reply) => {
    try {
      const { ruleId } = request.params as { ruleId: string };
      const result = await query(
        `UPDATE legal_mapping_rule SET approval_status = 'ROLLED_BACK', effective_to = NOW(), updated_at = NOW()
         WHERE rule_id = $1 AND approval_status = 'PUBLISHED' RETURNING *`,
        [ruleId],
      );
      if (result.rows.length === 0) return sendError(reply, 400, "INVALID_TRANSITION", "Rule must be in PUBLISHED status");
      return { rule: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to rollback rule");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // POST /api/v1/legal/rules/:ruleId/test — Test rule against sample context
  app.post("/api/v1/legal/rules/:ruleId/test", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["ruleId"], properties: { ruleId: { type: "string", format: "uuid" } } },
      body: {
        type: "object",
        additionalProperties: false,
        required: ["context"],
        properties: {
          context: {
            type: "object",
            properties: {
              category: { type: "string" },
              threat_score: { type: "number" },
              alert_type: { type: "string" },
              language: { type: "string" },
              keywords: { type: "string" },
              severity: { type: "string" },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { ruleId } = request.params as { ruleId: string };
      const { context } = request.body as { context: Record<string, unknown> };

      const ruleRes = await query("SELECT * FROM legal_mapping_rule WHERE rule_id = $1", [ruleId]);
      if (ruleRes.rows.length === 0) return send404(reply, "NOT_FOUND", "Rule not found");

      const rule = ruleRes.rows[0];
      const expression = rule.rule_expression as { operator: "AND" | "OR"; conditions: Array<{ field: string; op: string; value?: number | string; values?: string[] }> };

      const testCtx = {
        category: (context.category as string) || "",
        threat_score: Number(context.threat_score) || 0,
        alert_type: (context.alert_type as string) || "",
        platform: (context.platform as string) || "",
        language: (context.language as string) || "",
        keywords: (context.keywords as string) || "",
        sentiment: (context.sentiment as string) || "",
        severity: (context.severity as string) || "",
      };

      const result = testRuleExpression(expression, testCtx);
      return {
        rule_code: rule.rule_code,
        law_name: rule.law_name,
        provision_code: rule.provision_code,
        ...result,
      };
    } catch (err: unknown) {
      request.log.error(err, "Failed to test rule");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // GET /api/v1/legal/mappings/pending — Pending review queue
  app.get("/api/v1/legal/mappings/pending", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 200, default: 20 },
          offset: { type: "integer", minimum: 0, default: 0 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { limit = "20", offset = "0" } = request.query as { limit?: string; offset?: string };
      const result = await getPendingMappings(Number(limit), Number(offset));
      return { mappings: result.rows, total: result.total };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get pending legal mappings");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // PATCH /api/v1/legal/mappings/:mappingId/review — Review decision
  app.patch("/api/v1/legal/mappings/:mappingId/review", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["mappingId"], properties: { mappingId: { type: "string", format: "uuid" } } },
      body: {
        type: "object",
        additionalProperties: false,
        required: ["decision"],
        properties: {
          decision: { type: "string", enum: ["APPROVED", "REJECTED"] },
          reason: { type: "string" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { mappingId } = request.params as { mappingId: string };
      const { decision, reason } = request.body as { decision: "APPROVED" | "REJECTED"; reason?: string };
      const userId = request.authUser!.userId;
      const result = await reviewMapping(mappingId, userId, decision, reason);
      if (!result) return send404(reply, "NOT_FOUND", "Mapping not found");
      return result;
    } catch (err: unknown) {
      request.log.error(err, "Failed to review legal mapping");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });
}
