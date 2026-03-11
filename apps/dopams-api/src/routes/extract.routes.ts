import { FastifyInstance } from "fastify";
import { extractAndStore, getEntityGraph, getEntitiesForSource } from "../services/entity-extractor";
import { query } from "../db";
import { sendError, send404 } from "../errors";
import { resolveEntityTable } from "../services/entity-resolver";

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

      // Validate entity type via allowlist (prevents SQL injection)
      let resolved;
      try {
        resolved = resolveEntityTable(entityType);
      } catch {
        return sendError(reply, 400, "UNKNOWN_ENTITY_TYPE", `Unknown entity type: ${entityType}`);
      }
      const { table, idCol } = resolved;

      // Build extraction SQL per table — some need multi-column concatenation
      let sql: string;
      if (table === "lead") {
        sql = `SELECT COALESCE(summary, '') || ' ' || COALESCE(details, '') AS text FROM ${table} WHERE ${idCol} = $1`;
      } else if (table === "subject_profile") {
        // subject_profile has no single remarks column; concatenate identifiers/addresses JSON + full_name
        sql = `SELECT COALESCE(full_name, '') || ' ' || COALESCE(identifiers::text, '') || ' ' || COALESCE(addresses::text, '') AS text FROM ${table} WHERE ${idCol} = $1`;
      } else {
        sql = `SELECT ${resolved.textCol} AS text FROM ${table} WHERE ${idCol} = $1`;
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

  // Get entity graph
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
