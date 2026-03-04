import { FastifyInstance } from "fastify";
import {
  registerModel, listModels, getModel, getActiveModel,
  updateModelStatus, updateModelMetrics,
  addEvaluation, getEvaluations,
  logPrediction, getModelPerformanceStats, getVersionHistory
} from "../services/model-governance";
import { sendError } from "../errors";

export async function registerModelRoutes(app: FastifyInstance): Promise<void> {
  // Register a new model
  app.post("/api/v1/models", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["modelName", "modelType", "version"],
        properties: {
          modelName: { type: "string", minLength: 1, maxLength: 200 },
          modelType: { type: "string", minLength: 1, maxLength: 100 },
          version: { type: "string", minLength: 1, maxLength: 50 },
          description: { type: "string", maxLength: 2000 },
          status: { type: "string", enum: ["DRAFT", "TESTING", "ACTIVE", "DEPRECATED", "RETIRED"] },
          framework: { type: "string", maxLength: 100 },
          algorithmType: { type: "string", maxLength: 100 },
          trainingDataRef: { type: "string", maxLength: 500 },
          hyperparameters: { type: "object" },
          metrics: { type: "object" }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const body = request.body as any;
      const userId = (request as any).authUser?.userId;
      if (!body.modelName || !body.modelType || !body.version) {
        return reply.code(400).send({ error: "VALIDATION_ERROR", message: "modelName, modelType, and version are required" });
      }
      const result = await registerModel({ ...body, createdBy: userId });
      return reply.code(201).send(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("unique")) {
        return reply.code(409).send({ error: "DUPLICATE", message: "Model with this name and version already exists" });
      }
      request.log.error(err, "Failed to register model");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // List models
  app.get("/api/v1/models", async (request, reply) => {
    try {
      const { model_type, status } = request.query as { model_type?: string; status?: string };
      return { models: await listModels({ modelType: model_type, status }) };
    } catch (err: unknown) {
      request.log.error(err, "Failed to list models");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Get a model by ID
  app.get("/api/v1/models/:modelId", async (request, reply) => {
    try {
      const { modelId } = request.params as { modelId: string };
      const model = await getModel(modelId);
      if (!model) return reply.code(404).send({ error: "NOT_FOUND" });
      return model;
    } catch (err: unknown) {
      request.log.error(err, "Failed to get model");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Get active model by name
  app.get("/api/v1/models/active/:modelName", async (request, reply) => {
    try {
      const { modelName } = request.params as { modelName: string };
      const model = await getActiveModel(modelName);
      if (!model) return reply.code(404).send({ error: "NOT_FOUND", message: "No active model found" });
      return model;
    } catch (err: unknown) {
      request.log.error(err, "Failed to get active model");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Update model status (lifecycle management)
  app.patch("/api/v1/models/:modelId/status", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["status"],
        properties: {
          status: { type: "string", enum: ["DRAFT", "TESTING", "ACTIVE", "DEPRECATED", "RETIRED"] }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { modelId } = request.params as { modelId: string };
      const { status } = request.body as { status: string };
      if (!["DRAFT", "TESTING", "ACTIVE", "DEPRECATED", "RETIRED"].includes(status)) {
        return reply.code(400).send({ error: "INVALID_STATUS" });
      }
      const result = await updateModelStatus(modelId, status);
      if (!result) return reply.code(404).send({ error: "NOT_FOUND" });
      return result;
    } catch (err: unknown) {
      request.log.error(err, "Failed to update model status");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Update model metrics
  app.patch("/api/v1/models/:modelId/metrics", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["metrics"],
        properties: {
          metrics: { type: "object" }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { modelId } = request.params as { modelId: string };
      const { metrics } = request.body as { metrics: any };
      const result = await updateModelMetrics(modelId, metrics);
      if (!result) return reply.code(404).send({ error: "NOT_FOUND" });
      return result;
    } catch (err: unknown) {
      request.log.error(err, "Failed to update model metrics");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Get version history for a model name
  app.get("/api/v1/models/history/:modelName", async (request, reply) => {
    try {
      const { modelName } = request.params as { modelName: string };
      return { versions: await getVersionHistory(modelName) };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get model version history");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Add evaluation
  app.post("/api/v1/models/:modelId/evaluations", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["datasetName", "results"],
        properties: {
          datasetName: { type: "string", minLength: 1, maxLength: 200 },
          datasetSize: { type: "integer", minimum: 1 },
          results: { type: "object" },
          notes: { type: "string", maxLength: 2000 },
          passed: { type: "boolean" }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { modelId } = request.params as { modelId: string };
      const body = request.body as any;
      const userId = (request as any).authUser?.userId;
      const result = await addEvaluation({ ...body, modelId, evaluatedBy: userId });
      return reply.code(201).send(result);
    } catch (err: unknown) {
      request.log.error(err, "Failed to add model evaluation");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Get evaluations
  app.get("/api/v1/models/:modelId/evaluations", async (request, reply) => {
    try {
      const { modelId } = request.params as { modelId: string };
      return { evaluations: await getEvaluations(modelId) };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get model evaluations");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Log a prediction
  app.post("/api/v1/models/:modelId/predictions", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["input", "output"],
        properties: {
          input: { type: "object" },
          output: { type: "object" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          latencyMs: { type: "integer", minimum: 0 },
          feedback: { type: "string", enum: ["CORRECT", "INCORRECT", "PARTIAL", "PENDING"] },
          entityType: { type: "string", maxLength: 100 },
          entityId: { type: "string", maxLength: 200 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { modelId } = request.params as { modelId: string };
      const body = request.body as any;
      const result = await logPrediction({ ...body, modelId });
      return reply.code(201).send(result);
    } catch (err: unknown) {
      request.log.error(err, "Failed to log prediction");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Get performance stats
  app.get("/api/v1/models/:modelId/performance", async (request, reply) => {
    try {
      const { modelId } = request.params as { modelId: string };
      return await getModelPerformanceStats(modelId);
    } catch (err: unknown) {
      request.log.error(err, "Failed to get model performance stats");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });
}
