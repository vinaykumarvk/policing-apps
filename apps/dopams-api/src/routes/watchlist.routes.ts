import { FastifyInstance } from "fastify";
import { query } from "../db";
import { send400, send404, sendError } from "../errors";

export async function registerWatchlistRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/v1/watchlists — List
  app.get("/api/v1/watchlists", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          is_active: { type: "string", maxLength: 10 },
          limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
          offset: { type: "integer", minimum: 0, default: 0 },
        },
      },
    },
  }, async (request) => {
    const { is_active, limit: rawLimit, offset: rawOffset } = request.query as Record<string, string | undefined>;
    const limit = Math.min(parseInt(rawLimit || "50", 10) || 50, 200);
    const offset = Math.max(parseInt(rawOffset || "0", 10) || 0, 0);
    const unitId = request.authUser?.unitId || null;
    const isActiveBool = is_active === undefined ? null : is_active === "true";

    const result = await query(
      `SELECT w.watchlist_id, w.watchlist_name, w.description, w.alert_on_activity, w.is_active,
              w.owner_id, w.created_at,
              (SELECT COUNT(*)::int FROM watchlist_subject ws WHERE ws.watchlist_id = w.watchlist_id) AS subject_count,
              COUNT(*) OVER() AS total_count
       FROM watchlist w
       WHERE ($1::boolean IS NULL OR w.is_active = $1)
         AND w.unit_id = $2::uuid
       ORDER BY w.created_at DESC
       LIMIT $3 OFFSET $4`,
      [isActiveBool, unitId, limit, offset],
    );
    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
    return { watchlists: result.rows.map(({ total_count, ...r }) => r), total };
  });

  // GET /api/v1/watchlists/:id — Detail with subjects
  app.get("/api/v1/watchlists/:id", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await query(
      `SELECT watchlist_id, watchlist_name, description, criteria, alert_on_activity, is_active, owner_id, created_at, updated_at
       FROM watchlist WHERE watchlist_id = $1`,
      [id],
    );
    if (result.rows.length === 0) return send404(reply, "WATCHLIST_NOT_FOUND", "Watchlist not found");

    const subjects = await query(
      `SELECT ws.subject_id, sp.full_name, sp.subject_ref, ws.added_at, ws.notes
       FROM watchlist_subject ws
       JOIN subject_profile sp ON ws.subject_id = sp.subject_id
       WHERE ws.watchlist_id = $1
       ORDER BY ws.added_at DESC`,
      [id],
    );

    return { watchlist: result.rows[0], subjects: subjects.rows };
  });

  // POST /api/v1/watchlists — Create
  app.post("/api/v1/watchlists", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["watchlistName"],
        properties: {
          watchlistName: { type: "string" },
          description: { type: "string" },
          criteria: { type: "object", additionalProperties: true },
          alertOnActivity: { type: "boolean" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const { userId } = request.authUser!;
      const unitId = request.authUser?.unitId || null;

      const result = await query(
        `INSERT INTO watchlist (watchlist_name, description, criteria, alert_on_activity, owner_id, unit_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING watchlist_id, watchlist_name, is_active, created_at`,
        [body.watchlistName, body.description || null, JSON.stringify(body.criteria || {}),
         body.alertOnActivity !== false, userId, unitId],
      );
      reply.code(201);
      return { watchlist: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to create watchlist");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // POST /api/v1/watchlists/:id/subjects — Add subject to watchlist
  app.post("/api/v1/watchlists/:id/subjects", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: {
        type: "object",
        additionalProperties: false,
        required: ["subjectId"],
        properties: {
          subjectId: { type: "string", format: "uuid" },
          notes: { type: "string" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { subjectId, notes } = request.body as { subjectId: string; notes?: string };
      const { userId } = request.authUser!;

      await query(
        `INSERT INTO watchlist_subject (watchlist_id, subject_id, added_by, notes)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (watchlist_id, subject_id) DO NOTHING`,
        [id, subjectId, userId, notes || null],
      );
      reply.code(201);
      return { success: true, watchlistId: id, subjectId };
    } catch (err: unknown) {
      request.log.error(err, "Failed to add subject to watchlist");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // DELETE /api/v1/watchlists/:id/subjects/:subjectId — Remove subject
  app.delete("/api/v1/watchlists/:id/subjects/:subjectId", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id", "subjectId"], properties: {
        id: { type: "string", format: "uuid" },
        subjectId: { type: "string", format: "uuid" },
      }},
    },
  }, async (request, reply) => {
    const { id, subjectId } = request.params as { id: string; subjectId: string };
    const result = await query(
      `DELETE FROM watchlist_subject WHERE watchlist_id = $1 AND subject_id = $2`,
      [id, subjectId],
    );
    if ((result.rowCount ?? 0) === 0) return send404(reply, "NOT_FOUND", "Subject not in watchlist");
    return { success: true };
  });
}
