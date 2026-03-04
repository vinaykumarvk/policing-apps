import { FastifyInstance } from "fastify";
import { extractAndStore, getEntityGraph, getEntitiesForSource } from "../services/entity-extractor";
import { query } from "../db";
import { sendError, send404 } from "../errors";

export async function registerExtractRoutes(app: FastifyInstance): Promise<void> {
  // Extract entities from a source entity
  app.post("/api/v1/extract/:entityType/:entityId", {
    schema: {
      params: {
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
      const { entityType, entityId } = request.params as { entityType: string; entityId: string };

      let sql: string;

      switch (entityType) {
        case "forensic_case":
          sql = `SELECT description AS text FROM forensic_case WHERE case_id = $1`;
          break;
        case "forensic_finding":
          sql = `SELECT COALESCE(title, '') || ' ' || COALESCE(description, '') AS text FROM ai_finding WHERE finding_id = $1`;
          break;
        default:
          return sendError(reply, 400, "UNKNOWN_ENTITY_TYPE", `Unknown entity type: ${entityType}`);
      }

      const row = await query(sql, [entityId]);
      if (row.rows.length === 0) {
        return send404(reply, "ENTITY_NOT_FOUND", `${entityType} not found`);
      }

      const text: string = row.rows[0].text || "";
      if (!text.trim()) {
        return { entities: [], message: "No text content to extract from" };
      }

      const entities = await extractAndStore(entityType, entityId, text);
      return { entities };
    } catch (err: unknown) {
      request.log.error(err, "Failed to extract entities");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Get extracted entities for a source
  app.get("/api/v1/extract/:entityType/:entityId", {
    schema: {
      params: {
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
      const { entityType, entityId } = request.params as { entityType: string; entityId: string };
      const entities = await getEntitiesForSource(entityType, entityId);
      return { entities };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get extracted entities");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Get entity graph (uses entity_id PK from forensic schema)
  app.get("/api/v1/graph/:entityId", {
    schema: {
      params: {
        type: "object",
        additionalProperties: false,
        required: ["entityId"],
        properties: {
          entityId: { type: "string", format: "uuid" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { entityId } = request.params as { entityId: string };
      const { depth } = request.query as { depth?: string };
      const graph = await getEntityGraph(entityId, parseInt(depth || "2", 10));
      return graph;
    } catch (err: unknown) {
      request.log.error(err, "Failed to get entity graph");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });
}
