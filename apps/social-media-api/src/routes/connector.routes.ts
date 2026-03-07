import { FastifyInstance } from "fastify";
import { query } from "../db";
import { sendError, send400, send403, send404 } from "../errors";
import { deadLetterQueue } from "../connector-scheduler";

export async function registerConnectorRoutes(app: FastifyInstance): Promise<void> {
  // Admin-only guard
  function requireAdmin(roles: string[]): boolean {
    return roles.includes("PLATFORM_ADMINISTRATOR");
  }

  // GET /api/v1/connectors — List with pagination
  app.get("/api/v1/connectors", {
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
  }, async (request, reply) => {
    try {
      if (!requireAdmin(request.authUser!.roles)) {
        return send403(reply, "FORBIDDEN", "Admin access required");
      }
      const { is_active, limit: rawLimit, offset: rawOffset } = request.query as Record<string, string | undefined>;
      const limit = Math.min(Math.max(parseInt(rawLimit || "50", 10) || 50, 1), 200);
      const offset = Math.max(parseInt(rawOffset || "0", 10) || 0, 0);
      const isActiveBool = is_active === undefined ? null : is_active === "true";
      const result = await query(
        `SELECT connector_id, platform, connector_type, config_jsonb, is_active,
                last_poll_at, created_at, updated_at,
                COUNT(*) OVER() AS total_count
         FROM source_connector
         WHERE ($1::boolean IS NULL OR is_active = $1)
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [isActiveBool, limit, offset],
      );
      const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
      return { connectors: result.rows.map(({ total_count, ...r }) => r), total };
    } catch (err: unknown) {
      request.log.error(err, "Failed to list connectors");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // GET /api/v1/connectors/:id — Single connector detail
  app.get("/api/v1/connectors/:id", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
    },
  }, async (request, reply) => {
    try {
      if (!requireAdmin(request.authUser!.roles)) {
        return send403(reply, "FORBIDDEN", "Admin access required");
      }
      const { id } = request.params as { id: string };
      const result = await query(
        `SELECT connector_id, platform, connector_type, config_jsonb, is_active,
                last_poll_at, created_at, updated_at
         FROM source_connector WHERE connector_id = $1`,
        [id],
      );
      if (result.rows.length === 0) {
        return send404(reply, "CONNECTOR_NOT_FOUND", "Connector not found");
      }
      return { connector: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get connector");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // POST /api/v1/connectors — Create
  app.post("/api/v1/connectors", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["platform", "connectorType"],
        properties: {
          platform: { type: "string", maxLength: 64 },
          connectorType: { type: "string", maxLength: 64 },
          configJsonb: { type: "object" },
          isActive: { type: "boolean" },
          defaultLegalBasis: { type: "string", maxLength: 100 },
          defaultRetentionDays: { type: "integer", minimum: 1 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      if (!requireAdmin(request.authUser!.roles)) {
        return send403(reply, "FORBIDDEN", "Admin access required");
      }
      const { platform, connectorType, configJsonb, isActive, defaultLegalBasis, defaultRetentionDays } = request.body as {
        platform: string; connectorType: string; configJsonb?: Record<string, unknown>; isActive?: boolean;
        defaultLegalBasis?: string; defaultRetentionDays?: number;
      };
      const result = await query(
        `INSERT INTO source_connector (platform, connector_type, config_jsonb, is_active, default_legal_basis, default_retention_days)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING connector_id, platform, connector_type, config_jsonb, is_active, default_legal_basis, default_retention_days, created_at`,
        [platform, connectorType, JSON.stringify(configJsonb || {}), isActive !== false, defaultLegalBasis || null, defaultRetentionDays || 365],
      );
      reply.code(201);
      return { connector: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to create connector");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // PUT /api/v1/connectors/:id — Update
  app.put("/api/v1/connectors/:id", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: {
        type: "object",
        additionalProperties: false,
        properties: {
          platform: { type: "string", maxLength: 64 },
          connectorType: { type: "string", maxLength: 64 },
          configJsonb: { type: "object" },
          isActive: { type: "boolean" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      if (!requireAdmin(request.authUser!.roles)) {
        return send403(reply, "FORBIDDEN", "Admin access required");
      }
      const { id } = request.params as { id: string };
      const { platform, connectorType, configJsonb, isActive } = request.body as {
        platform?: string; connectorType?: string; configJsonb?: Record<string, unknown>; isActive?: boolean;
      };

      const sets: string[] = [];
      const params: any[] = [];
      let idx = 1;

      if (platform !== undefined) { sets.push(`platform = $${idx++}`); params.push(platform); }
      if (connectorType !== undefined) { sets.push(`connector_type = $${idx++}`); params.push(connectorType); }
      if (configJsonb !== undefined) { sets.push(`config_jsonb = $${idx++}`); params.push(JSON.stringify(configJsonb)); }
      if (isActive !== undefined) { sets.push(`is_active = $${idx++}`); params.push(isActive); }

      if (sets.length === 0) {
        return send400(reply, "NO_FIELDS", "No fields to update");
      }

      sets.push(`updated_at = NOW()`);
      params.push(id);

      const result = await query(
        `UPDATE source_connector SET ${sets.join(", ")} WHERE connector_id = $${idx}
         RETURNING connector_id, platform, connector_type, config_jsonb, is_active, last_poll_at, updated_at`,
        params,
      );
      if (result.rows.length === 0) {
        return send404(reply, "CONNECTOR_NOT_FOUND", "Connector not found");
      }
      return { connector: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to update connector");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // GET /api/v1/connectors/health — Health summary for all connectors
  app.get("/api/v1/connectors/health", async (request, reply) => {
    try {
      if (!requireAdmin(request.authUser!.roles)) {
        return send403(reply, "FORBIDDEN", "Admin access required");
      }
      const result = await query(
        `SELECT connector_id, platform, is_active, health_status, error_count,
                last_error, last_poll_at, backoff_until
         FROM source_connector ORDER BY platform`,
      );
      return { connectors: result.rows };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get connector health");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // FR-03: GET /api/v1/connectors/retention-flagged — Content past retention_until
  app.get("/api/v1/connectors/retention-flagged", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
          offset: { type: "integer", minimum: 0, default: 0 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      if (!requireAdmin(request.authUser!.roles)) {
        return send403(reply, "FORBIDDEN", "Admin access required");
      }
      const { limit: rawLimit, offset: rawOffset } = request.query as Record<string, string | undefined>;
      const limit = Math.min(parseInt(rawLimit || "50", 10) || 50, 200);
      const offset = Math.max(parseInt(rawOffset || "0", 10) || 0, 0);
      const result = await query(
        `SELECT content_id, platform, author_handle, content_url, legal_basis, retention_until, retention_flagged, ingested_at,
                COUNT(*) OVER() AS total_count
         FROM content_item
         WHERE retention_until IS NOT NULL AND retention_until < NOW()
         ORDER BY retention_until ASC
         LIMIT $1 OFFSET $2`,
        [limit, offset],
      );
      const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
      return { content: result.rows.map(({ total_count, ...r }) => r), total };
    } catch (err: unknown) {
      request.log.error(err, "Failed to list retention-flagged content");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // FR-03: POST /api/v1/connectors/flag-expired — Flag content past retention
  app.post("/api/v1/connectors/flag-expired", async (request, reply) => {
    try {
      if (!requireAdmin(request.authUser!.roles)) {
        return send403(reply, "FORBIDDEN", "Admin access required");
      }
      const result = await query(
        `UPDATE content_item SET retention_flagged = TRUE
         WHERE retention_until IS NOT NULL AND retention_until < NOW() AND retention_flagged = FALSE
         RETURNING content_id`,
      );
      return { flaggedCount: result.rowCount || 0, flaggedIds: result.rows.map((r) => r.content_id) };
    } catch (err: unknown) {
      request.log.error(err, "Failed to flag expired content");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // POST /api/v1/connectors/:id/reset-health — Reset error state
  app.post("/api/v1/connectors/:id/reset-health", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    try {
      if (!requireAdmin(request.authUser!.roles)) {
        return send403(reply, "FORBIDDEN", "Admin access required");
      }
      const { id } = request.params as { id: string };
      const result = await query(
        `UPDATE source_connector SET error_count = 0, last_error = NULL, health_status = 'UNKNOWN', backoff_until = NULL, updated_at = NOW()
         WHERE connector_id = $1 RETURNING connector_id, platform, health_status`,
        [id],
      );
      if (result.rows.length === 0) return send404(reply, "CONNECTOR_NOT_FOUND", "Connector not found");
      return { connector: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to reset connector health");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // GET /api/v1/connectors/dead-letter — Dead letter queue
  app.get("/api/v1/connectors/dead-letter", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
          offset: { type: "integer", minimum: 0, default: 0 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      if (!requireAdmin(request.authUser!.roles)) {
        return send403(reply, "FORBIDDEN", "Admin access required");
      }
      const { limit: rawLimit, offset: rawOffset } = request.query as Record<string, string | undefined>;
      const limit = Math.min(parseInt(rawLimit || "50", 10) || 50, 200);
      const offset = Math.max(parseInt(rawOffset || "0", 10) || 0, 0);
      return deadLetterQueue.listFailed(limit, offset);
    } catch (err: unknown) {
      request.log.error(err, "Failed to list dead letters");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // POST /api/v1/connectors/dead-letter/:id/retry — Retry dead letter entry
  app.post("/api/v1/connectors/dead-letter/:id/retry", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    try {
      if (!requireAdmin(request.authUser!.roles)) {
        return send403(reply, "FORBIDDEN", "Admin access required");
      }
      const { id } = request.params as { id: string };
      const found = await deadLetterQueue.retry(id);
      if (!found) return send404(reply, "DLQ_NOT_FOUND", "Dead letter entry not found");
      return { success: true };
    } catch (err: unknown) {
      request.log.error(err, "Failed to retry dead letter");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });
}
