import { FastifyInstance } from "fastify";
import { query } from "../db";
import { send404, sendError } from "../errors";
import { syncToDopams, retryFailedSyncs } from "../services/dopams-sync";

export async function registerDopamsSyncRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/v1/dopams-sync/:caseId — Trigger sync to DOPAMS
  app.post("/api/v1/dopams-sync/:caseId", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["caseId"], properties: { caseId: { type: "string", format: "uuid" } } },
    },
  }, async (request, reply) => {
    try {
      const { caseId } = request.params as { caseId: string };
      const { userId } = request.authUser!;

      // Verify case exists
      const caseResult = await query(`SELECT case_id FROM forensic_case WHERE case_id = $1`, [caseId]);
      if (caseResult.rows.length === 0) return send404(reply, "CASE_NOT_FOUND", "Case not found");

      const result = await syncToDopams(caseId, userId);
      return { sync: result };
    } catch (err: unknown) {
      request.log.error(err, "Failed to trigger DOPAMS sync");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // GET /api/v1/dopams-sync — List sync events
  app.get("/api/v1/dopams-sync", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          case_id: { type: "string", format: "uuid" },
          status: { type: "string", maxLength: 50 },
          limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
          offset: { type: "integer", minimum: 0, default: 0 },
        },
      },
    },
  }, async (request) => {
    const { case_id, status, limit: rawLimit, offset: rawOffset } = request.query as Record<string, string | undefined>;
    const limit = Math.min(parseInt(rawLimit || "50", 10) || 50, 200);
    const offset = Math.max(parseInt(rawOffset || "0", 10) || 0, 0);

    const result = await query(
      `SELECT sync_event_id, case_id, sync_type, direction, status, retry_count,
              response_code, error_message, created_at,
              COUNT(*) OVER() AS total_count
       FROM dopams_sync_event
       WHERE ($1::uuid IS NULL OR case_id = $1)
         AND ($2::text IS NULL OR status = $2)
       ORDER BY created_at DESC
       LIMIT $3 OFFSET $4`,
      [case_id || null, status || null, limit, offset],
    );
    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
    return { events: result.rows.map(({ total_count, ...r }) => r), total };
  });

  // POST /api/v1/dopams-sync/:eventId/retry — Retry a specific failed sync
  app.post("/api/v1/dopams-sync/:eventId/retry", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["eventId"], properties: { eventId: { type: "string", format: "uuid" } } },
    },
  }, async (request, reply) => {
    try {
      const { eventId } = request.params as { eventId: string };
      const result = await query(
        `SELECT sync_event_id, case_id, status FROM dopams_sync_event WHERE sync_event_id = $1`,
        [eventId],
      );
      if (result.rows.length === 0) return send404(reply, "SYNC_NOT_FOUND", "Sync event not found");
      if (result.rows[0].status !== "FAILED") {
        return sendError(reply, 400, "NOT_RETRYABLE", "Only FAILED sync events can be retried");
      }

      const syncResult = await syncToDopams(result.rows[0].case_id, request.authUser!.userId);
      return { sync: syncResult };
    } catch (err: unknown) {
      request.log.error(err, "Failed to retry DOPAMS sync");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // POST /api/v1/dopams-sync/retry-all — Retry all due failed syncs
  app.post("/api/v1/dopams-sync/retry-all", async (request, reply) => {
    try {
      const retried = await retryFailedSyncs();
      return { retried };
    } catch (err: unknown) {
      request.log.error(err, "Failed to retry syncs");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // POST /api/v1/dopams-sync/webhook — Inbound webhook from DOPAMS
  app.post("/api/v1/dopams-sync/webhook", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["eventType", "payload"],
        properties: {
          eventType: { type: "string", enum: ["SUBJECT_UPDATE", "CASE_UPDATE", "ALERT_CREATED", "LEAD_UPDATE"] },
          payload: {
            type: "object",
            additionalProperties: true,
            properties: {
              sourceId: { type: "string" },
              timestamp: { type: "string", format: "date-time" },
            },
          },
          correlationId: { type: "string" },
          version: { type: "string" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { eventType, payload, correlationId, version } = request.body as {
        eventType: string;
        payload: Record<string, unknown>;
        correlationId?: string;
        version?: string;
      };

      // Record inbound sync event
      const result = await query(
        `INSERT INTO dopams_sync_event (sync_type, direction, status, payload_jsonb, correlation_id)
         VALUES ($1, 'INBOUND', 'RECEIVED', $2, $3)
         RETURNING sync_event_id`,
        [eventType, JSON.stringify({ ...payload, version }), correlationId || null],
      );

      reply.code(202);
      return { received: true, syncEventId: result.rows[0].sync_event_id, eventType };
    } catch (err: unknown) {
      request.log.error(err, "Failed to process DOPAMS webhook");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // GET /api/v1/dopams-sync/field-mappings — List field mappings
  app.get("/api/v1/dopams-sync/field-mappings", async (request) => {
    const result = await query(
      `SELECT mapping_id, source_field, target_field, transform_fn, version, is_active, created_at
       FROM dopams_field_mapping
       WHERE is_active = TRUE
       ORDER BY source_field`,
    );
    return { mappings: result.rows };
  });

  // PUT /api/v1/dopams-sync/field-mappings/:id — Update field mapping (bumps version)
  app.put("/api/v1/dopams-sync/field-mappings/:id", {
    schema: {
      params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: {
        type: "object",
        additionalProperties: false,
        properties: {
          targetField: { type: "string" },
          transformFn: { type: "string" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, string>;
      const sets: string[] = [];
      const params: unknown[] = [];
      let idx = 1;
      if (body.targetField) { sets.push(`target_field = $${idx++}`); params.push(body.targetField); }
      if (body.transformFn !== undefined) { sets.push(`transform_fn = $${idx++}`); params.push(body.transformFn || null); }
      if (sets.length === 0) return send404(reply, "NO_FIELDS", "No fields to update");
      sets.push(`version = version + 1`);
      sets.push(`updated_at = NOW()`);
      params.push(id);
      const result = await query(
        `UPDATE dopams_field_mapping SET ${sets.join(", ")} WHERE mapping_id = $${idx} RETURNING *`,
        params,
      );
      if (result.rows.length === 0) return send404(reply, "MAPPING_NOT_FOUND", "Field mapping not found");
      return { mapping: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to update field mapping");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });
}
