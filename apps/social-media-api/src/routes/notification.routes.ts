import { FastifyInstance } from "fastify";
import { query } from "../db";
import { sendError, send404 } from "../errors";

export async function registerNotificationRoutes(app: FastifyInstance): Promise<void> {
  // GET unread count
  app.get("/api/v1/notifications/count", async (request, reply) => {
    try {
      const { userId } = request.authUser!;
      const result = await query(
        `SELECT COUNT(*)::int AS unread FROM notification_event WHERE user_id = $1 AND is_read = FALSE`,
        [userId],
      );
      return { unread: result.rows[0]?.unread || 0 };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get notification count");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // GET notifications list
  app.get("/api/v1/notifications", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          unread: { type: "string", maxLength: 10 },
          limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
          offset: { type: "integer", minimum: 0, default: 0 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { userId } = request.authUser!;
      const { unread, limit: rawLimit, offset: rawOffset } = request.query as Record<string, string | undefined>;
      const limit = Math.min(Math.max(parseInt(rawLimit || "20", 10) || 20, 1), 100);
      const offset = Math.max(parseInt(rawOffset || "0", 10) || 0, 0);
      const unreadOnly = unread === "true";
      const result = await query(
        `SELECT *, COUNT(*) OVER() AS total_count FROM notification_event
         WHERE user_id = $1 AND ($2::boolean IS NULL OR is_read = NOT $2)
         ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
        [userId, unreadOnly ? true : null, limit, offset],
      );
      const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
      return { notifications: result.rows.map(({ total_count, ...r }: any) => r), total };
    } catch (err: unknown) {
      request.log.error(err, "Failed to list notifications");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // PATCH mark as read
  app.patch("/api/v1/notifications/:id/read", {
    schema: { params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { userId } = request.authUser!;
      const result = await query(
        `UPDATE notification_event SET is_read = TRUE WHERE notification_id = $1 AND user_id = $2 RETURNING notification_id`,
        [id, userId],
      );
      if (result.rows.length === 0) return send404(reply, "NOTIFICATION_NOT_FOUND", "Notification not found");
      return { success: true };
    } catch (err: unknown) {
      request.log.error(err, "Failed to mark notification as read");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });
}
