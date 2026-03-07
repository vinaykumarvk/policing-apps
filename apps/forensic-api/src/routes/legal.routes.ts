import { FastifyInstance } from "fastify";
import { suggestStatutes, autoMapEntity, getMappings, confirmMapping, addManualMapping, getStatutes } from "../services/legal-mapper";
import { query } from "../db";
import { sendError, send404 } from "../errors";

export async function registerLegalRoutes(app: FastifyInstance): Promise<void> {
  // Get all statutes (with optional search)
  app.get("/api/v1/legal/sections", async (request, reply) => {
    try {
      const { q } = request.query as { q?: string };
      const statutes = await getStatutes(q);
      return { statutes };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get statutes");
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
          entityId: { type: "string" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { entityType, entityId } = request.body as { entityType: string; entityId: string };
      if (!entityType || !entityId) {
        return sendError(reply, 400, "VALIDATION_ERROR", "entityType and entityId are required");
      }

      let tableName: string, textColumn: string, idColumn: string;
      switch (entityType) {
        case "forensic_case":
          tableName = "forensic_case"; textColumn = "description"; idColumn = "case_id"; break;
        case "forensic_finding":
          tableName = "ai_finding"; textColumn = "description"; idColumn = "finding_id"; break;
        default:
          return sendError(reply, 400, "UNKNOWN_ENTITY_TYPE", `Unknown entity type: ${entityType}`);
      }

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
          entityId: { type: "string" },
          statuteId: { type: "string" },
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

  // POST /api/v1/legal/mappings/:mappingId/reject — Reject a mapping
  app.post("/api/v1/legal/mappings/:mappingId/reject", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["mappingId"], properties: { mappingId: { type: "string", format: "uuid" } } },
      body: {
        type: "object",
        additionalProperties: false,
        required: ["reason"],
        properties: { reason: { type: "string" } },
      },
    },
  }, async (request, reply) => {
    try {
      const { mappingId } = request.params as { mappingId: string };
      const { reason } = request.body as { reason: string };
      const userId = request.authUser!.userId;

      const result = await query(
        `UPDATE legal_mapping SET state_id = 'REJECTED', rejected_by = $1, rejected_at = NOW(), rejection_reason = $2
         WHERE mapping_id = $3 AND state_id IN ('SUGGESTED', 'PENDING_APPROVAL')
         RETURNING mapping_id, state_id, rejected_at`,
        [userId, reason, mappingId],
      );
      if (result.rows.length === 0) return send404(reply, "MAPPING_NOT_FOUND", "Mapping not found or not in rejectable state");
      return { mapping: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to reject legal mapping");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // POST /api/v1/legal/mappings/:mappingId/approve — Supervisor approval
  app.post("/api/v1/legal/mappings/:mappingId/approve", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["mappingId"], properties: { mappingId: { type: "string", format: "uuid" } } },
      body: {
        type: "object",
        additionalProperties: false,
        properties: { rationale: { type: "string" } },
      },
    },
  }, async (request, reply) => {
    try {
      const { mappingId } = request.params as { mappingId: string };
      const { rationale } = request.body as { rationale?: string };
      const userId = request.authUser!.userId;
      const roles = request.authUser!.roles || [];

      // Only SUPERVISOR, ADMINISTRATOR, or LEGAL_ADVISOR can approve
      if (!roles.some((r: string) => ["SUPERVISOR", "ADMINISTRATOR", "LEGAL_ADVISOR"].includes(r))) {
        return sendError(reply, 403, "FORBIDDEN", "Supervisor or Legal Advisor role required for approval");
      }

      const updates: string[] = [
        `state_id = 'CONFIRMED'`,
        `confirmed = TRUE`,
        `confirmed_by = $1`,
        `confirmed_at = NOW()`,
        `approved_by = $1`,
        `approved_at = NOW()`,
      ];
      const params: unknown[] = [userId];
      let idx = 2;

      if (rationale) {
        updates.push(`rationale = $${idx++}`);
        params.push(rationale);
      }
      params.push(mappingId);

      const result = await query(
        `UPDATE legal_mapping SET ${updates.join(", ")}
         WHERE mapping_id = $${idx} AND state_id IN ('SUGGESTED', 'PENDING_APPROVAL')
         RETURNING mapping_id, state_id, approved_at, rationale`,
        params,
      );
      if (result.rows.length === 0) return send404(reply, "MAPPING_NOT_FOUND", "Mapping not found or not in approvable state");
      return { mapping: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to approve legal mapping");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // GET /api/v1/legal/mappings/pending — List pending approval mappings
  app.get("/api/v1/legal/mappings/pending", {
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
  }, async (request) => {
    const { limit: rawLimit, offset: rawOffset } = request.query as Record<string, string | undefined>;
    const limit = Math.min(parseInt(rawLimit || "50", 10) || 50, 200);
    const offset = Math.max(parseInt(rawOffset || "0", 10) || 0, 0);
    const result = await query(
      `SELECT m.mapping_id, m.entity_type, m.entity_id, m.statute_id, m.mapping_source,
              m.confidence, m.state_id, m.rationale, m.created_at,
              s.act_name, s.section, s.description AS statute_description,
              COUNT(*) OVER() AS total_count
       FROM legal_mapping m
       JOIN statute_library s ON m.statute_id = s.statute_id
       WHERE m.state_id = 'PENDING_APPROVAL'
       ORDER BY m.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
    return { mappings: result.rows.map(({ total_count, ...r }) => r), total };
  });
}
