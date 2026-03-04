import { FastifyInstance } from "fastify";
import { classifyAndStore, getClassification, reviewClassification, getRoleDistribution, getRecidivists } from "../services/drug-classifier";
import { query } from "../db";
import { sendError } from "../errors";

export async function registerDrugClassifyRoutes(app: FastifyInstance): Promise<void> {
  // Classify a subject/entity for drug role
  app.post("/api/v1/drug-classify/:entityType/:entityId", {
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

      let tableName: string;
      let textColumn: string;
      let idColumn: string;

      switch (entityType) {
        case "sm_alert":
          tableName = "sm_alert"; textColumn = "description"; idColumn = "alert_id"; break;
        case "sm_case":
          tableName = "case_record"; textColumn = "description"; idColumn = "case_id"; break;
        default:
          return reply.code(400).send({ error: "UNKNOWN_ENTITY_TYPE", message: `Unsupported entity type: ${entityType}` });
      }

      const entityResult = await query(`SELECT ${textColumn} FROM ${tableName} WHERE ${idColumn} = $1`, [entityId]);
      if (entityResult.rows.length === 0) return reply.code(404).send({ error: "NOT_FOUND", message: "Entity not found" });

      const text = entityResult.rows[0][textColumn] || "";
      const result = await classifyAndStore(entityType, entityId, text);
      return reply.code(201).send(result);
    } catch (err: unknown) {
      request.log.error(err, "Failed to classify entity for drug role");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Get classifications for an entity
  app.get("/api/v1/drug-classify/:entityType/:entityId", {
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
      const classifications = await getClassification(entityType, entityId);
      return { classifications };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get drug classifications");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Review a classification
  app.patch("/api/v1/drug-classify/:classificationId/review", {
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
        required: ["reviewStatus"],
        properties: {
          reviewStatus: { type: "string", enum: ["CONFIRMED", "REJECTED", "UNDER_REVIEW"] },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { classificationId } = request.params as { classificationId: string };
      const { reviewStatus } = request.body as { reviewStatus: string };
      const userId = request.authUser?.userId;

      if (!["CONFIRMED", "REJECTED", "UNDER_REVIEW"].includes(reviewStatus)) {
        return reply.code(400).send({ error: "INVALID_STATUS", message: "reviewStatus must be CONFIRMED, REJECTED, or UNDER_REVIEW" });
      }

      const result = await reviewClassification(classificationId, reviewStatus, userId!);
      if (!result) return reply.code(404).send({ error: "NOT_FOUND", message: "Classification not found" });
      return result;
    } catch (err: unknown) {
      request.log.error(err, "Failed to review drug classification");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Role distribution dashboard data
  app.get("/api/v1/drug-classify/distribution", async (request, reply) => {
    try {
      return { distribution: await getRoleDistribution() };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get drug role distribution");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Get recidivists
  app.get("/api/v1/drug-classify/recidivists", async (request, reply) => {
    try {
      return { recidivists: await getRecidivists() };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get recidivists");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });
}
