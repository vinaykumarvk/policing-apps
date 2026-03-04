import { FastifyInstance } from "fastify";
import { classifyEntity, getClassification, overrideClassification } from "../services/classifier";
import { sendError } from "../errors";

export async function registerClassifyRoutes(app: FastifyInstance): Promise<void> {
  // Classify an entity
  app.post("/api/v1/classify/:entityType/:entityId", {
    schema: {
      params: {
        type: "object",
        required: ["entityType", "entityId"],
        properties: {
          entityType: { type: "string", enum: ["dopams_alert", "dopams_lead", "dopams_subject"] },
          entityId: { type: "string", format: "uuid" },
        },
      },
    },
  }, async (request, reply) => {
    const { entityType, entityId } = request.params as { entityType: string; entityId: string };
    try {
      const result = await classifyEntity(entityType, entityId);
      return result;
    } catch (err: unknown) {
      request.log.error(err, "Entity classification failed");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Get risk score / classification for an entity
  app.get("/api/v1/classify/:entityType/:entityId", {
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
      const result = await getClassification(entityType, entityId);
      if (!result) return reply.code(404).send({ error: "NOT_FOUND", message: "No classification found" });
      return result;
    } catch (err: unknown) {
      request.log.error(err, "Failed to get classification");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Analyst override
  app.patch("/api/v1/classify/:classificationId/override", {
    schema: {
      params: {
        type: "object",
        required: ["classificationId"],
        properties: {
          classificationId: { type: "string", format: "uuid" },
        },
      },
      body: {
        type: "object",
        additionalProperties: false,
        required: ["category", "riskScore", "reason"],
        properties: {
          category: { type: "string" },
          riskScore: { type: "number" },
          reason: { type: "string" },
        },
      },
    },
  }, async (request, reply) => {
    const { classificationId } = request.params as { classificationId: string };
    const { category, riskScore, reason } = request.body as { category: string; riskScore: number; reason: string };
    const userId = request.authUser?.userId;
    try {
      const result = await overrideClassification(classificationId, userId!, category, riskScore, reason);
      if (!result) return reply.code(404).send({ error: "NOT_FOUND" });
      return result;
    } catch (err: unknown) {
      request.log.error(err, "Classification override failed");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });
}
