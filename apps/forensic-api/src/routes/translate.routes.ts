import { FastifyInstance } from "fastify";
import { translateText, getTranslations } from "../services/translator";
import { query } from "../db";
import { sendError, send400, send404 } from "../errors";

export async function registerTranslateRoutes(app: FastifyInstance): Promise<void> {
  // Translate text for an entity
  app.post("/api/v1/translate", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["entityType", "entityId", "targetLanguage"],
        properties: {
          entityType: { type: "string" },
          entityId: { type: "string", format: "uuid" },
          targetLanguage: { type: "string" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { entityType, entityId, targetLanguage } = request.body as {
        entityType: string;
        entityId: string;
        targetLanguage: string;
      };

      // Resolve table, text column, and id column based on entity type
      let tableName: string;
      let textColumn: string;
      let idColumn: string;

      switch (entityType) {
        case "forensic_case":
          tableName = "forensic_case";
          textColumn = "description";
          idColumn = "case_id";
          break;
        case "forensic_finding":
          tableName = "ai_finding";
          textColumn = "description";
          idColumn = "finding_id";
          break;
        default:
          return send400(reply, "UNKNOWN_ENTITY_TYPE", `Unsupported entity type: ${entityType}`);
      }

      const entityResult = await query(
        `SELECT ${textColumn} FROM ${tableName} WHERE ${idColumn} = $1`,
        [entityId],
      );

      if (entityResult.rows.length === 0) {
        return send404(reply, "NOT_FOUND", "Entity not found");
      }

      const text = entityResult.rows[0][textColumn] || "";
      if (!text) {
        return send400(reply, "NO_TEXT", "Entity has no translatable text");
      }

      const userId = request.authUser?.userId;

      const result = await translateText({
        sourceEntityType: entityType,
        sourceEntityId: entityId,
        text,
        targetLanguage,
        createdBy: userId,
      });

      return result;
    } catch (err: unknown) {
      request.log.error(err, "Failed to translate text");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Get translations for an entity
  app.get("/api/v1/translations/:entityType/:entityId", {
    schema: {
      params: {
        type: "object",
        required: ["entityType", "entityId"],
        properties: {
          entityType: { type: "string" },
          entityId: { type: "string", format: "uuid" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { entityType, entityId } = request.params as { entityType: string; entityId: string };
      const translations = await getTranslations(entityType, entityId);
      return { translations };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get translations");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });
}
