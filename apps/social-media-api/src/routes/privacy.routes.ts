import { FastifyInstance } from "fastify";
import { query } from "../db";
import { sendError, send404 } from "../errors";
import { createRoleGuard } from "@puda/api-core";
import { submitJustification, hasActiveJustification, getSupervisorAuditStats, getAccessLog } from "../services/access-justification";

const requireSupervisor = createRoleGuard(["SUPERVISOR", "PLATFORM_ADMINISTRATOR"]);

export async function registerPrivacyRoutes(app: FastifyInstance): Promise<void> {

  // Submit access justification
  app.post("/api/v1/access-justification", {
    schema: {
      body: {
        type: "object", required: ["entityType", "entityId", "justificationType", "reasonText"],
        properties: {
          entityType: { type: "string" }, entityId: { type: "string", format: "uuid" },
          justificationType: { type: "string" }, reasonText: { type: "string" },
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
      const id = await submitJustification(userId, entityType, entityId, justificationType, reasonText, caseId);
      reply.code(201);
      return { justificationId: id };
    } catch (err: unknown) {
      request.log.error(err, "Failed to submit access justification");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Check active justification
  app.get("/api/v1/access-justification/check/:entityType/:entityId", {
    schema: {
      params: { type: "object", required: ["entityType", "entityId"], properties: { entityType: { type: "string" }, entityId: { type: "string", format: "uuid" } } },
    },
  }, async (request, reply) => {
    try {
      const { entityType, entityId } = request.params as { entityType: string; entityId: string };
      const { userId } = request.authUser!;
      const active = await hasActiveJustification(userId, entityType, entityId);
      return { hasActive: active };
    } catch (err: unknown) {
      request.log.error(err, "Failed to check justification");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Supervisor audit stats
  app.get("/api/v1/supervisor/audit-stats", async (request, reply) => {
    if (!requireSupervisor(request, reply)) return;
    try {
      const { dateFrom, dateTo, userId } = request.query as { dateFrom?: string; dateTo?: string; userId?: string };
      const stats = await getSupervisorAuditStats({ dateFrom, dateTo, userId });
      return { stats };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get supervisor audit stats");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Detailed access log
  app.get("/api/v1/supervisor/access-log", async (request, reply) => {
    if (!requireSupervisor(request, reply)) return;
    try {
      const { limit, offset, userId, entityType, dateFrom, dateTo } = request.query as {
        limit?: string; offset?: string; userId?: string; entityType?: string; dateFrom?: string; dateTo?: string;
      };
      const result = await getAccessLog(
        Number(limit) || 50, Number(offset) || 0,
        { userId, entityType, dateFrom, dateTo },
      );
      return { log: result.rows, total: result.total };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get access log");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // PII redaction log for a content item
  app.get("/api/v1/privacy/redaction-log/:contentId", {
    schema: { params: { type: "object", required: ["contentId"], properties: { contentId: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    try {
      const { contentId } = request.params as { contentId: string };
      const result = await query(
        "SELECT * FROM pii_redaction_log WHERE content_id = $1 ORDER BY created_at DESC",
        [contentId],
      );
      return { redactions: result.rows };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get redaction log");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });
}
