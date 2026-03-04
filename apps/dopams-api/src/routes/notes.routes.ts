import { FastifyInstance } from "fastify";
import { query } from "../db";
import { sendError } from "../errors";

export async function registerNotesRoutes(app: FastifyInstance): Promise<void> {
  // GET notes for any entity
  app.get("/api/v1/:entityType/:entityId/notes", {
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
      const result = await query(
        `SELECT n.note_id, n.entity_type, n.entity_id, n.note_text,
                n.created_by, n.created_at, u.full_name AS author_name
         FROM entity_note n
         LEFT JOIN user_account u ON u.user_id = n.created_by
         WHERE n.entity_type = $1 AND n.entity_id = $2
         ORDER BY n.created_at DESC`,
        [entityType, entityId],
      );
      return { notes: result.rows };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get notes");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // POST new note
  app.post("/api/v1/:entityType/:entityId/notes", {
    schema: {
      params: {
        type: "object",
        required: ["entityType", "entityId"],
        properties: {
          entityType: { type: "string" },
          entityId: { type: "string", format: "uuid" },
        },
      },
      body: {
        type: "object",
        additionalProperties: false,
        required: ["noteText"],
        properties: {
          noteText: { type: "string" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { entityType, entityId } = request.params as { entityType: string; entityId: string };
      const { noteText } = request.body as { noteText: string };
      const { userId } = request.authUser!;
      const result = await query(
        `INSERT INTO entity_note (entity_type, entity_id, note_text, created_by)
         VALUES ($1, $2, $3, $4)
         RETURNING note_id, entity_type, entity_id, note_text, created_by, created_at`,
        [entityType, entityId, noteText, userId],
      );
      reply.code(201);
      return { note: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to create note");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // GET activity timeline (from audit_event table)
  app.get("/api/v1/:entityType/:entityId/activity", {
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
      const result = await query(
        `SELECT * FROM audit_event
         WHERE entity_type = $1 AND entity_id = $2
         ORDER BY created_at DESC
         LIMIT 100`,
        [entityType, entityId],
      );
      return { activity: result.rows };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get activity timeline");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });
}
