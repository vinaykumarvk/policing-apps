import { FastifyInstance } from "fastify";
import { query } from "../db";
import { send400, send404, sendError } from "../errors";
import { mergeEntities, splitEntity, getEntityTimeline } from "../services/entity-operations";

export async function registerEntityOpsRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /api/v1/entities/merge
   * Merge sourceId into targetId. Source is marked is_merged=true.
   */
  app.post("/api/v1/entities/merge", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["targetId", "sourceId"],
        properties: {
          targetId: { type: "string", format: "uuid" },
          sourceId: { type: "string", format: "uuid" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { targetId, sourceId } = request.body as { targetId: string; sourceId: string };

      if (targetId === sourceId) {
        return send400(reply, "SAME_ENTITY", "targetId and sourceId must be different");
      }

      const { userId } = request.authUser!;
      const result = await mergeEntities(targetId, sourceId, userId);
      return { merge: result };
    } catch (err: unknown) {
      const e = err as Error & { code?: string };
      if (e.code === "TARGET_NOT_FOUND") return send404(reply, "TARGET_NOT_FOUND", "Target entity not found");
      if (e.code === "SOURCE_NOT_FOUND") return send404(reply, "SOURCE_NOT_FOUND", "Source entity not found");
      if (e.code === "ALREADY_MERGED") return send400(reply, "ALREADY_MERGED", "Source entity is already merged");
      request.log.error(err, "Failed to merge entities");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  /**
   * POST /api/v1/entities/split
   * Split an entity into multiple new child entities.
   */
  app.post("/api/v1/entities/split", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["entityId", "newEntities"],
        properties: {
          entityId: { type: "string", format: "uuid" },
          newEntities: {
            type: "array",
            minItems: 1,
            maxItems: 20,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["entityType", "entityValue"],
              properties: {
                entityType: { type: "string", maxLength: 100 },
                entityValue: { type: "string", maxLength: 500 },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { entityId, newEntities } =
        request.body as { entityId: string; newEntities: Array<{ entityType: string; entityValue: string }> };

      const { userId } = request.authUser!;
      const created = await splitEntity(entityId, newEntities, userId);
      reply.code(201);
      return { entities: created, count: created.length };
    } catch (err: unknown) {
      const e = err as Error & { code?: string };
      if (e.code === "ENTITY_NOT_FOUND") return send404(reply, "ENTITY_NOT_FOUND", "Entity not found");
      if (e.code === "INVALID_INPUT") return send400(reply, "INVALID_INPUT", e.message || "Invalid input");
      request.log.error(err, "Failed to split entity");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  /**
   * GET /api/v1/entities/:id/timeline
   * Retrieve the timeline of events for a specific entity.
   */
  app.get("/api/v1/entities/:id/timeline", {
    schema: {
      params: {
        type: "object",
        additionalProperties: false,
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      // Verify entity exists
      const check = await query(
        `SELECT entity_id FROM extracted_entity WHERE entity_id = $1`,
        [id],
      );
      if (check.rows.length === 0) {
        return send404(reply, "ENTITY_NOT_FOUND", "Entity not found");
      }

      const timeline = await getEntityTimeline(id);
      return { entityId: id, timeline, total: timeline.length };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get entity timeline");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });
}
