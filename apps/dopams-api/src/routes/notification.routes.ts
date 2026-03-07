import { FastifyInstance } from "fastify";
import { createNotificationRoutes } from "@puda/api-core";
import { query } from "../db";
import { send400, send404, sendError } from "../errors";
import { snoozeNotification } from "../services/notification-engine";

// Base notification routes from shared package
const baseRoutes = createNotificationRoutes({ queryFn: query });

export async function registerNotificationRoutes(app: FastifyInstance): Promise<void> {
  // Register base CRUD routes
  await baseRoutes(app);

  // POST /api/v1/notifications/:id/snooze — Snooze a notification
  app.post("/api/v1/notifications/:id/snooze", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: {
        type: "object",
        additionalProperties: false,
        required: ["snoozedUntil"],
        properties: { snoozedUntil: { type: "string", format: "date-time" } },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { snoozedUntil } = request.body as { snoozedUntil: string };
      await snoozeNotification(id, snoozedUntil);
      return { success: true, notificationId: id, snoozedUntil };
    } catch (err: unknown) {
      request.log.error(err, "Failed to snooze notification");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // --- Notification Rules CRUD ---

  app.get("/api/v1/notification-rules", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          entity_type: { type: "string", maxLength: 100 },
          is_active: { type: "string", maxLength: 10 },
          limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
          offset: { type: "integer", minimum: 0, default: 0 },
        },
      },
    },
  }, async (request) => {
    const { entity_type, is_active, limit: rawLimit, offset: rawOffset } = request.query as Record<string, string | undefined>;
    const limit = Math.min(parseInt(rawLimit || "50", 10) || 50, 200);
    const offset = Math.max(parseInt(rawOffset || "0", 10) || 0, 0);
    const isActiveBool = is_active === undefined ? null : is_active === "true";

    const result = await query(
      `SELECT rule_id, rule_name, entity_type, event_type, conditions, recipient_role,
              channel, template, priority, is_active, created_at,
              COUNT(*) OVER() AS total_count
       FROM notification_rule
       WHERE ($1::text IS NULL OR entity_type = $1)
         AND ($2::boolean IS NULL OR is_active = $2)
       ORDER BY created_at DESC
       LIMIT $3 OFFSET $4`,
      [entity_type || null, isActiveBool, limit, offset],
    );
    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
    return { rules: result.rows.map(({ total_count, ...r }) => r), total };
  });

  app.post("/api/v1/notification-rules", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["ruleName", "entityType", "eventType", "template"],
        properties: {
          ruleName: { type: "string" },
          entityType: { type: "string" },
          eventType: { type: "string" },
          conditions: { type: "object", additionalProperties: true },
          recipientRole: { type: "string" },
          recipientUserId: { type: "string", format: "uuid" },
          channel: { type: "string", enum: ["IN_APP", "EMAIL", "SMS", "PUSH"] },
          template: { type: "string" },
          priority: { type: "string", enum: ["LOW", "NORMAL", "HIGH", "CRITICAL"] },
          isActive: { type: "boolean" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const { userId } = request.authUser!;
      const result = await query(
        `INSERT INTO notification_rule (rule_name, entity_type, event_type, conditions, recipient_role, recipient_user_id, channel, template, priority, is_active, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING rule_id, rule_name, entity_type, event_type, channel, is_active, created_at`,
        [body.ruleName, body.entityType, body.eventType,
         JSON.stringify(body.conditions || {}), body.recipientRole || null,
         body.recipientUserId || null, body.channel || "IN_APP",
         body.template, body.priority || "NORMAL", body.isActive !== false, userId],
      );
      reply.code(201);
      return { rule: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to create notification rule");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  app.put("/api/v1/notification-rules/:id", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: {
        type: "object",
        additionalProperties: false,
        properties: {
          ruleName: { type: "string" },
          conditions: { type: "object", additionalProperties: true },
          recipientRole: { type: "string" },
          channel: { type: "string", enum: ["IN_APP", "EMAIL", "SMS", "PUSH"] },
          template: { type: "string" },
          priority: { type: "string", enum: ["LOW", "NORMAL", "HIGH", "CRITICAL"] },
          isActive: { type: "boolean" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;
      const sets: string[] = [];
      const params: unknown[] = [];
      let idx = 1;

      if (body.ruleName !== undefined) { sets.push(`rule_name = $${idx++}`); params.push(body.ruleName); }
      if (body.conditions !== undefined) { sets.push(`conditions = $${idx++}`); params.push(JSON.stringify(body.conditions)); }
      if (body.recipientRole !== undefined) { sets.push(`recipient_role = $${idx++}`); params.push(body.recipientRole); }
      if (body.channel !== undefined) { sets.push(`channel = $${idx++}`); params.push(body.channel); }
      if (body.template !== undefined) { sets.push(`template = $${idx++}`); params.push(body.template); }
      if (body.priority !== undefined) { sets.push(`priority = $${idx++}`); params.push(body.priority); }
      if (body.isActive !== undefined) { sets.push(`is_active = $${idx++}`); params.push(body.isActive); }

      if (sets.length === 0) return send400(reply, "NO_FIELDS", "No fields to update");
      sets.push(`updated_at = NOW()`);
      params.push(id);

      const result = await query(
        `UPDATE notification_rule SET ${sets.join(", ")} WHERE rule_id = $${idx}
         RETURNING rule_id, rule_name, entity_type, event_type, is_active, updated_at`,
        params,
      );
      if (result.rows.length === 0) return send404(reply, "RULE_NOT_FOUND", "Notification rule not found");
      return { rule: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to update notification rule");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });
}
