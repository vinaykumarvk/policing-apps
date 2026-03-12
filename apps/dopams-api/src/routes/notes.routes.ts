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

  // GET activity timeline — composite feed from real investigative data
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
      const { entityId } = request.params as { entityType: string; entityId: string };

      // Check which optional tables exist (seizure, warrant may not be migrated yet)
      const tableCheck = await query(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'current_schema'
            OR table_schema = 'public'
           AND table_name IN ('seizure', 'warrant')`,
      );
      const existingTables = new Set(tableCheck.rows.map((r: { table_name: string }) => r.table_name));

      // Build UNION ALL parts dynamically — core tables always, optional tables conditionally
      const parts: string[] = [];

      // Alerts raised for this subject
      parts.push(`
        SELECT a.alert_id AS event_id, 'ALERT_RAISED' AS event_type,
               a.alert_type AS sub_type,
               COALESCE(a.description, a.title, a.alert_type || ' alert triggered') AS summary,
               a.severity, a.state_id AS detail_status,
               a.assigned_to AS actor_id, u1.full_name AS actor_name,
               a.created_at
        FROM alert a
        LEFT JOIN user_account u1 ON u1.user_id = a.assigned_to
        WHERE a.subject_id = $1
      `);

      // FIRs filed against subject
      parts.push(`
        SELECT f.fir_record_id, 'FIR_FILED', f.role_in_case,
               'FIR ' || f.fir_number || ' at ' || COALESCE(f.police_station, 'unknown PS'),
               NULL, f.case_stage,
               NULL, NULL,
               COALESCE(f.fir_date, f.created_at)
        FROM fir_record f
        WHERE f.subject_id = $1
      `);

      // Leads created for subject
      parts.push(`
        SELECT l.lead_id, 'LEAD_CREATED', l.source_type,
               COALESCE(l.summary, l.source_type || ' lead'),
               l.priority, l.state_id,
               l.assigned_to, u3.full_name,
               l.created_at
        FROM lead l
        LEFT JOIN user_account u3 ON u3.user_id = l.assigned_to
        WHERE l.subject_id = $1
      `);

      // Notes added
      parts.push(`
        SELECT n.note_id, 'NOTE_ADDED', NULL,
               LEFT(n.note_text, 120),
               NULL, NULL,
               n.created_by, u4.full_name,
               n.created_at
        FROM entity_note n
        LEFT JOIN user_account u4 ON u4.user_id = n.created_by
        WHERE n.entity_type = 'subjects' AND n.entity_id = $1
      `);

      // Audit log: only meaningful state transitions (not page views)
      parts.push(`
        SELECT ae.audit_id, 'STATUS_CHANGE',
               ae.to_state,
               ae.from_state || ' → ' || ae.to_state,
               NULL, ae.to_state,
               ae.actor_id, u5.full_name,
               ae.created_at
        FROM audit_event ae
        LEFT JOIN user_account u5 ON u5.user_id = ae.actor_id
        WHERE ae.entity_type = 'subjects' AND ae.entity_id = $1
          AND ae.from_state IS NOT NULL AND ae.to_state IS NOT NULL
          AND ae.from_state <> ae.to_state
      `);

      // Optional: seizures (table may not exist)
      if (existingTables.has("seizure")) {
        parts.push(`
          SELECT s.seizure_id, 'SEIZURE_RECORDED', s.substance_type,
                 COALESCE(s.quantity_display, '') || ' ' || s.substance_type || ' seized',
                 NULL, s.status,
                 s.seizing_officer_id, u6.full_name,
                 s.seizure_date
          FROM seizure s
          LEFT JOIN user_account u6 ON u6.user_id = s.seizing_officer_id
          WHERE s.subject_id = $1
        `);
      }

      // Optional: warrants (table may not exist)
      if (existingTables.has("warrant")) {
        parts.push(`
          SELECT w.warrant_id, 'WARRANT_ISSUED', w.warrant_type,
                 w.warrant_type || ' warrant — ' || COALESCE(w.court_name, 'court'),
                 NULL, w.status,
                 NULL, NULL,
                 COALESCE(w.issued_date, w.created_at)
          FROM warrant w
          WHERE w.subject_id = $1
        `);
      }

      const sql = `WITH timeline AS (${parts.join("\nUNION ALL\n")})
        SELECT event_id, event_type, sub_type, summary, severity,
               detail_status, actor_id, actor_name, created_at
        FROM timeline
        ORDER BY created_at DESC
        LIMIT 50`;

      const result = await query(sql, [entityId]);
      return { activity: result.rows };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get activity timeline");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });
}
