import { FastifyInstance } from "fastify";
import { query } from "../db";
import { sendError, send404 } from "../errors";
import { createRoleGuard } from "@puda/api-core";

const requireSupervisor = createRoleGuard(["SUPERVISORY_OFFICER", "ADMINISTRATOR"]);

export async function registerPrivacyRoutes(app: FastifyInstance): Promise<void> {

  // POST /api/v1/access-justification — Submit access justification
  app.post("/api/v1/access-justification", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["entityType", "entityId", "justificationType", "reasonText"],
        properties: {
          entityType: { type: "string", enum: ["alert", "lead", "subject_profile", "dopams_case", "memo", "evidence", "dossier", "interrogation_report"] },
          entityId: { type: "string", format: "uuid" },
          justificationType: { type: "string", maxLength: 100 },
          reasonText: { type: "string", minLength: 1, maxLength: 2000 },
          caseId: { type: "string", format: "uuid" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { entityType, entityId, justificationType, reasonText, caseId } = request.body as {
        entityType: string; entityId: string; justificationType: string; reasonText: string; caseId?: string;
      };
      const { userId } = request.authUser!;

      const result = await query(
        `INSERT INTO access_justification (user_id, entity_type, entity_id, justification_type, reason_text, case_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING justification_id`,
        [userId, entityType, entityId, justificationType, reasonText, caseId || null],
      );

      reply.code(201);
      return { justificationId: result.rows[0].justification_id };
    } catch (err: unknown) {
      request.log.error(err, "Failed to submit access justification");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // GET /api/v1/access-justification/check/:entityType/:entityId — Check active justification
  app.get("/api/v1/access-justification/check/:entityType/:entityId", {
    schema: {
      params: {
        type: "object",
        additionalProperties: false,
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
      const { userId } = request.authUser!;

      const result = await query(
        `SELECT justification_id FROM access_justification
         WHERE user_id = $1 AND entity_type = $2 AND entity_id = $3
           AND created_at >= NOW() - INTERVAL '8 hours'
         ORDER BY created_at DESC LIMIT 1`,
        [userId, entityType, entityId],
      );

      return { hasActive: result.rows.length > 0 };
    } catch (err: unknown) {
      request.log.error(err, "Failed to check justification");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // GET /api/v1/supervisor/audit-stats — Supervisor audit statistics
  app.get("/api/v1/supervisor/audit-stats", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          dateFrom: { type: "string", format: "date" },
          dateTo: { type: "string", format: "date" },
          userId: { type: "string", format: "uuid" },
        },
      },
    },
  }, async (request, reply) => {
    if (!requireSupervisor(request, reply)) return;
    try {
      const { dateFrom, dateTo, userId } = request.query as { dateFrom?: string; dateTo?: string; userId?: string };

      const result = await query(
        `SELECT
           u.user_id, u.full_name, u.login,
           COUNT(aj.justification_id)::int AS total_justifications,
           COUNT(DISTINCT aj.entity_type)::int AS unique_entity_types,
           COUNT(DISTINCT aj.entity_id)::int AS unique_entities,
           MAX(aj.created_at) AS last_access
         FROM user_account u
         LEFT JOIN access_justification aj ON aj.user_id = u.user_id
           AND ($1::date IS NULL OR aj.created_at >= $1::date)
           AND ($2::date IS NULL OR aj.created_at <= ($2::date + INTERVAL '1 day'))
         WHERE u.is_active = TRUE
           AND ($3::uuid IS NULL OR u.user_id = $3)
         GROUP BY u.user_id, u.full_name, u.login
         HAVING COUNT(aj.justification_id) > 0
         ORDER BY total_justifications DESC`,
        [dateFrom || null, dateTo || null, userId || null],
      );

      return { stats: result.rows };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get supervisor audit stats");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // GET /api/v1/supervisor/access-log — Detailed access log
  app.get("/api/v1/supervisor/access-log", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
          offset: { type: "integer", minimum: 0, default: 0 },
          userId: { type: "string", format: "uuid" },
          entityType: { type: "string", maxLength: 50 },
          dateFrom: { type: "string", format: "date" },
          dateTo: { type: "string", format: "date" },
        },
      },
    },
  }, async (request, reply) => {
    if (!requireSupervisor(request, reply)) return;
    try {
      const { limit: rawLimit, offset: rawOffset, userId, entityType, dateFrom, dateTo } = request.query as {
        limit?: number; offset?: number; userId?: string; entityType?: string; dateFrom?: string; dateTo?: string;
      };
      const limit = Math.min(rawLimit ?? 50, 200);
      const offset = Math.max(rawOffset ?? 0, 0);

      const result = await query(
        `SELECT aj.justification_id, aj.user_id, aj.entity_type, aj.entity_id,
                aj.justification_type, aj.reason_text, aj.case_id, aj.created_at,
                u.full_name AS user_name, u.login,
                COUNT(*) OVER() AS total_count
         FROM access_justification aj
         LEFT JOIN user_account u ON u.user_id = aj.user_id
         WHERE ($1::uuid IS NULL OR aj.user_id = $1)
           AND ($2::text IS NULL OR aj.entity_type = $2)
           AND ($3::date IS NULL OR aj.created_at >= $3::date)
           AND ($4::date IS NULL OR aj.created_at <= ($4::date + INTERVAL '1 day'))
         ORDER BY aj.created_at DESC
         LIMIT $5 OFFSET $6`,
        [userId || null, entityType || null, dateFrom || null, dateTo || null, limit, offset],
      );

      const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
      return { log: result.rows.map(({ total_count, ...r }: any) => r), total };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get access log");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // GET /api/v1/privacy/redaction-log/:entityId — PII redaction log for an entity
  app.get("/api/v1/privacy/redaction-log/:entityId", {
    schema: {
      params: {
        type: "object",
        additionalProperties: false,
        required: ["entityId"],
        properties: { entityId: { type: "string", format: "uuid" } },
      },
    },
  }, async (request, reply) => {
    try {
      const { entityId } = request.params as { entityId: string };
      const result = await query(
        `SELECT * FROM pii_redaction_log WHERE entity_id = $1 ORDER BY created_at DESC`,
        [entityId],
      );
      return { redactions: result.rows };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get redaction log");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });
}
