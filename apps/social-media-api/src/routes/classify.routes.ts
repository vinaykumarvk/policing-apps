import { FastifyInstance } from "fastify";
import { classifyEntity, getClassification, overrideClassification } from "../services/classifier";
import { sendError } from "../errors";
import { query } from "../db";

const ALERT_THRESHOLD = 50;

function calcPriority(score: number): string {
  if (score >= 85) return "CRITICAL";
  if (score >= 70) return "HIGH";
  if (score >= 50) return "MEDIUM";
  return "LOW";
}

export async function registerClassifyRoutes(app: FastifyInstance): Promise<void> {
  // Classify an entity
  app.post("/api/v1/classify/:entityType/:entityId", {
    schema: {
      params: {
        type: "object",
        required: ["entityType", "entityId"],
        properties: {
          entityType: { type: "string", enum: ["sm_alert", "sm_case", "sm_evidence", "content_item"] },
          entityId: { type: "string", format: "uuid" },
        },
      },
    },
  }, async (request, reply) => {
    const { entityType, entityId } = request.params as { entityType: string; entityId: string };
    try {
      const result = await classifyEntity(entityType, entityId);

      // Auto-create alert for content_item with high risk score (if none exists)
      if (entityType === "content_item") {
        const riskScore = parseFloat(result.risk_score) || 0;
        if (riskScore >= ALERT_THRESHOLD) {
          const existing = await query(
            `SELECT alert_id FROM sm_alert WHERE content_id = $1 LIMIT 1`,
            [entityId],
          );
          if (existing.rows.length === 0) {
            const ci = await query(
              `SELECT platform, content_text, author_handle, content_url FROM content_item WHERE content_id = $1`,
              [entityId],
            );
            const content = ci.rows[0] || {};
            const priority = calcPriority(riskScore);
            await query(
              `INSERT INTO sm_alert
                 (alert_type, priority, title, description, content_id, state_id,
                  alert_ref)
               VALUES
                 ('AUTO_DETECTED', $1, $2, $3, $4, 'NEW',
                  'SM-ALERT-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('sm_alert_ref_seq')::text, 6, '0'))`,
              [
                priority,
                `${content.platform || "Unknown"} — ${(content.content_text || "").slice(0, 100)}`,
                `Classified ${result.category} content. Risk score: ${riskScore}. Author: ${content.author_handle || "unknown"}. URL: ${content.content_url || "N/A"}`,
                entityId,
              ],
            );
            request.log.info({ entityId, riskScore, priority }, "Auto-created alert from classification");
          }
        }
      }

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
