import { FastifyInstance } from "fastify";
import { query } from "../db";
import { sendError, send404 } from "../errors";
import { createRoleGuard } from "@puda/api-core";

const requireAnalyst = createRoleGuard(["ANALYST", "SUPERVISOR", "PLATFORM_ADMINISTRATOR"]);

export async function registerPlatformCooperationRoutes(app: FastifyInstance): Promise<void> {

  // List requests
  app.get("/api/v1/platform-cooperation/requests", async (request, reply) => {
    try {
      const { status, platform, limit, offset } = request.query as {
        status?: string; platform?: string; limit?: string; offset?: string;
      };
      const unitId = request.authUser?.unitId;
      let whereClause = "WHERE r.unit_id = $1";
      const params: unknown[] = [unitId];
      let paramIdx = 2;

      if (status) { whereClause += ` AND r.status = $${paramIdx++}`; params.push(status); }
      if (platform) { whereClause += ` AND r.platform = $${paramIdx++}`; params.push(platform); }

      const result = await query(
        `SELECT r.*, u.full_name AS created_by_name
         FROM platform_preservation_request r
         LEFT JOIN user_account u ON u.user_id = r.created_by
         ${whereClause}
         ORDER BY r.created_at DESC
         LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
        [...params, Number(limit) || 50, Number(offset) || 0],
      );
      return { requests: result.rows };
    } catch (err: unknown) {
      request.log.error(err, "Failed to list platform requests");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Create request
  app.post("/api/v1/platform-cooperation/requests", {
    schema: {
      body: {
        type: "object", required: ["platform", "requestType"],
        properties: {
          platform: { type: "string" }, requestType: { type: "string" },
          caseId: { type: "string", format: "uuid" }, alertId: { type: "string", format: "uuid" },
          targetAccounts: { type: "array" }, targetContent: { type: "array" },
          legalAuthority: { type: "string" }, validFrom: { type: "string" }, validUntil: { type: "string" },
        },
      },
    },
  }, async (request, reply) => {
    if (!requireAnalyst(request, reply)) return;
    try {
      const body = request.body as Record<string, unknown>;
      const { userId } = request.authUser!;
      const unitId = request.authUser?.unitId;

      const refResult = await query(
        `SELECT 'SM-PLT-' || EXTRACT(YEAR FROM NOW())::text || '-' || LPAD(nextval('sm_platform_req_ref_seq')::text, 6, '0') AS ref`,
      );

      const result = await query(
        `INSERT INTO platform_preservation_request
           (request_ref, platform, case_id, alert_id, request_type, target_accounts, target_content,
            legal_authority, valid_from, valid_until, created_by, unit_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [
          refResult.rows[0].ref, body.platform, body.caseId || null, body.alertId || null,
          body.requestType, JSON.stringify(body.targetAccounts || []), JSON.stringify(body.targetContent || []),
          body.legalAuthority || null, body.validFrom || null, body.validUntil || null,
          userId, unitId,
        ],
      );
      reply.code(201);
      return { request: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to create platform request");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Get single request
  app.get("/api/v1/platform-cooperation/requests/:id", {
    schema: { params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const result = await query(
        `SELECT r.*, u.full_name AS created_by_name
         FROM platform_preservation_request r
         LEFT JOIN user_account u ON u.user_id = r.created_by
         WHERE r.request_id = $1`,
        [id],
      );
      if (result.rows.length === 0) return send404(reply, "NOT_FOUND", "Request not found");
      return { request: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get platform request");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Update request status
  app.patch("/api/v1/platform-cooperation/requests/:id", {
    schema: {
      params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: { type: "object", properties: { status: { type: "string" }, generatedDocumentUrl: { type: "string" } } },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;
      const sets: string[] = ["updated_at = NOW()"];
      const params: unknown[] = [];
      let paramIdx = 1;

      if (body.status) { sets.push(`status = $${paramIdx++}`); params.push(body.status); }
      if (body.generatedDocumentUrl) { sets.push(`generated_document_url = $${paramIdx++}`); params.push(body.generatedDocumentUrl); }

      params.push(id);
      const result = await query(
        `UPDATE platform_preservation_request SET ${sets.join(", ")} WHERE request_id = $${paramIdx} RETURNING *`,
        params,
      );
      if (result.rowCount === 0) return send404(reply, "NOT_FOUND", "Request not found");
      return { request: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to update platform request");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Log platform response
  app.post("/api/v1/platform-cooperation/requests/:id/responses", {
    schema: {
      params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: {
        type: "object", required: ["responseType"],
        properties: { responseType: { type: "string" }, responseRef: { type: "string" }, details: { type: "object" } },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;

      const result = await query(
        `INSERT INTO platform_response (request_id, response_type, response_ref, details)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [id, body.responseType, body.responseRef || null, JSON.stringify(body.details || {})],
      );

      // Auto-update request status based on response type
      const statusMap: Record<string, string> = {
        ACKNOWLEDGEMENT: "ACKNOWLEDGED",
        FULL_FULFILLMENT: "FULFILLED",
        REJECTION: "REJECTED",
      };
      const newStatus = statusMap[body.responseType as string];
      if (newStatus) {
        await query(
          "UPDATE platform_preservation_request SET status = $1, updated_at = NOW() WHERE request_id = $2",
          [newStatus, id],
        );
      }

      reply.code(201);
      return { response: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to log platform response");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Get responses for a request
  app.get("/api/v1/platform-cooperation/requests/:id/responses", {
    schema: { params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const result = await query(
        "SELECT * FROM platform_response WHERE request_id = $1 ORDER BY response_date DESC",
        [id],
      );
      return { responses: result.rows };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get platform responses");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // List legal templates
  app.get("/api/v1/platform-cooperation/templates", async (request, reply) => {
    try {
      const result = await query(
        "SELECT * FROM legal_template WHERE is_active = TRUE ORDER BY template_name",
      );
      return { templates: result.rows };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get legal templates");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });
}
