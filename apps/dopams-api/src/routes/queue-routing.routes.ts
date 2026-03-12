import { FastifyInstance } from "fastify";
import { query } from "../db";
import { sendError, send400, send404 } from "../errors";
import { createRoleGuard } from "@puda/api-core";

const requireAdmin = createRoleGuard(["ADMINISTRATOR", "SUPERVISORY_OFFICER"]);

export async function registerQueueRoutingRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/v1/queue-routing/rules — List all routing rules
  app.get("/api/v1/queue-routing/rules", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          isActive: { type: "boolean" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const result = await query(
        `SELECT rule_id, rule_name, category, min_risk_score, max_risk_score, target_queue,
                priority_order, is_active, created_by, created_at, updated_at
         FROM queue_routing_rule ORDER BY priority_order ASC, created_at DESC`,
      );
      return { rules: result.rows };
    } catch (err: unknown) {
      request.log.error(err, "Failed to list queue routing rules");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // POST /api/v1/queue-routing/rules — Create a routing rule
  app.post("/api/v1/queue-routing/rules", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["ruleName", "targetQueue"],
        properties: {
          ruleName: { type: "string", maxLength: 200 },
          category: { type: "string", maxLength: 128 },
          minRiskScore: { type: "number", minimum: 0, maximum: 100 },
          maxRiskScore: { type: "number", minimum: 0, maximum: 100 },
          targetQueue: { type: "string", enum: ["HIGH", "MEDIUM", "LOW", "CRITICAL"] },
          priorityOrder: { type: "integer", minimum: 0 },
        },
      },
    },
  }, async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    try {
      const { ruleName, category, minRiskScore, maxRiskScore, targetQueue, priorityOrder } = request.body as {
        ruleName: string; category?: string; minRiskScore?: number; maxRiskScore?: number; targetQueue: string; priorityOrder?: number;
      };
      const { userId } = request.authUser!;

      const result = await query(
        `INSERT INTO queue_routing_rule (rule_name, category, min_risk_score, max_risk_score, target_queue, priority_order, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING rule_id, rule_name, category, min_risk_score, max_risk_score, target_queue, priority_order, is_active, created_at`,
        [ruleName, category || null, minRiskScore ?? 0, maxRiskScore ?? 100, targetQueue, priorityOrder ?? 0, userId],
      );
      reply.code(201);
      return { rule: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to create queue routing rule");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // PATCH /api/v1/queue-routing/rules/:ruleId — Update a routing rule
  app.patch("/api/v1/queue-routing/rules/:ruleId", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["ruleId"], properties: { ruleId: { type: "string", format: "uuid" } } },
      body: {
        type: "object",
        additionalProperties: false,
        properties: {
          ruleName: { type: "string", maxLength: 200 },
          category: { type: "string", maxLength: 128 },
          minRiskScore: { type: "number", minimum: 0, maximum: 100 },
          maxRiskScore: { type: "number", minimum: 0, maximum: 100 },
          targetQueue: { type: "string", enum: ["HIGH", "MEDIUM", "LOW", "CRITICAL"] },
          priorityOrder: { type: "integer", minimum: 0 },
          isActive: { type: "boolean" },
        },
      },
    },
  }, async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    try {
      const { ruleId } = request.params as { ruleId: string };
      const body = request.body as Record<string, unknown>;

      const sets: string[] = [];
      const params: unknown[] = [];
      let idx = 1;

      if (body.ruleName !== undefined) { sets.push(`rule_name = $${idx++}`); params.push(body.ruleName); }
      if (body.category !== undefined) { sets.push(`category = $${idx++}`); params.push(body.category); }
      if (body.minRiskScore !== undefined) { sets.push(`min_risk_score = $${idx++}`); params.push(body.minRiskScore); }
      if (body.maxRiskScore !== undefined) { sets.push(`max_risk_score = $${idx++}`); params.push(body.maxRiskScore); }
      if (body.targetQueue !== undefined) { sets.push(`target_queue = $${idx++}`); params.push(body.targetQueue); }
      if (body.priorityOrder !== undefined) { sets.push(`priority_order = $${idx++}`); params.push(body.priorityOrder); }
      if (body.isActive !== undefined) { sets.push(`is_active = $${idx++}`); params.push(body.isActive); }

      if (sets.length === 0) return send400(reply, "NO_FIELDS", "No fields to update");

      sets.push(`updated_at = NOW()`);
      params.push(ruleId);

      const result = await query(
        `UPDATE queue_routing_rule SET ${sets.join(", ")} WHERE rule_id = $${idx} RETURNING *`,
        params,
      );
      if (result.rows.length === 0) return send404(reply, "RULE_NOT_FOUND", "Queue routing rule not found");
      return { rule: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to update queue routing rule");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // DELETE /api/v1/queue-routing/rules/:ruleId — Deactivate a routing rule
  app.delete("/api/v1/queue-routing/rules/:ruleId", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["ruleId"], properties: { ruleId: { type: "string", format: "uuid" } } },
    },
  }, async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    try {
      const { ruleId } = request.params as { ruleId: string };
      const result = await query(
        `UPDATE queue_routing_rule SET is_active = FALSE, updated_at = NOW() WHERE rule_id = $1 RETURNING rule_id`,
        [ruleId],
      );
      if (result.rows.length === 0) return send404(reply, "RULE_NOT_FOUND", "Queue routing rule not found");
      return { success: true };
    } catch (err: unknown) {
      request.log.error(err, "Failed to delete queue routing rule");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // POST /api/v1/queue-routing/route — Route an alert to the appropriate queue
  app.post("/api/v1/queue-routing/route", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["alertId"],
        properties: {
          alertId: { type: "string", format: "uuid" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { alertId } = request.body as { alertId: string };

      // Get the alert's classification
      const classResult = await query(
        `SELECT category, risk_score FROM classification_result WHERE entity_type = 'dopams_alert' AND entity_id = $1
         ORDER BY updated_at DESC LIMIT 1`,
        [alertId],
      );

      if (classResult.rows.length === 0) {
        return send404(reply, "CLASSIFICATION_NOT_FOUND", "No classification found for this alert");
      }

      const { category, risk_score } = classResult.rows[0];
      const riskScore = parseFloat(risk_score);

      // Find matching queue routing rule
      const ruleResult = await query(
        `SELECT target_queue FROM queue_routing_rule
         WHERE is_active = TRUE
           AND ($1::text IS NULL OR category IS NULL OR category = $1)
           AND min_risk_score <= $2 AND max_risk_score >= $2
         ORDER BY priority_order ASC
         LIMIT 1`,
        [category, riskScore],
      );

      const targetQueue = ruleResult.rows.length > 0 ? ruleResult.rows[0].target_queue : "DEFAULT";

      // Update alert queue
      await query(`UPDATE alert SET priority_queue = $1, updated_at = NOW() WHERE alert_id = $2`, [targetQueue, alertId]);

      return { alertId, targetQueue, category, riskScore };
    } catch (err: unknown) {
      request.log.error(err, "Failed to route alert");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });
}
