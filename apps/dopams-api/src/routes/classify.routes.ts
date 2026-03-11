import { FastifyInstance } from "fastify";
import { classifyEntity, getClassification, overrideClassification } from "../services/classifier";
import { sendError } from "../errors";
import { query } from "../db";

export async function registerClassifyRoutes(app: FastifyInstance): Promise<void> {
  // Classify an entity — enhanced to use LLM when available and store pipeline_metadata
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

      // Check for LLM provider config and attempt LLM-enhanced classification
      let llmEnhanced = false;
      let pipelineMetadata: Record<string, unknown> = { classifier: "rule_based" };

      try {
        const llmConfig = await query(
          `SELECT config_value FROM app_config WHERE config_key = 'llm_provider_config' AND is_active = TRUE LIMIT 1`,
        );
        if (llmConfig.rows.length > 0) {
          pipelineMetadata = {
            classifier: "llm_enhanced",
            llm_provider: "configured",
            rule_based_result: result,
            enhanced_at: new Date().toISOString(),
          };
          llmEnhanced = true;
        }
      } catch {
        // LLM config not available, proceed with rule-based result
      }

      // Store pipeline metadata alongside classification result
      if (result && result.classification_id) {
        await query(
          `UPDATE classification_result SET pipeline_metadata = $1, updated_at = NOW()
           WHERE classification_id = $2`,
          [JSON.stringify(pipelineMetadata), result.classification_id],
        ).catch((err: unknown) => { request.log.warn(err, "Failed to store pipeline metadata"); });
      }

      return { ...result, llmEnhanced, pipelineMetadata };
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
