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

      let tableName: string, textColumn: string, idColumn: string;
      switch (entityType) {
        case "dopams_alert":
          tableName = "alert"; textColumn = "description"; idColumn = "alert_id"; break;
        case "dopams_lead":
          tableName = "lead"; textColumn = "summary"; idColumn = "lead_id"; break;
        case "dopams_case":
          tableName = "dopams_case"; textColumn = "description"; idColumn = "case_id"; break;
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
}
