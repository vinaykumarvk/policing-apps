import { createAdminRoutes } from "@puda/api-core";
import { FastifyInstance } from "fastify";
import { query } from "../db";
import { sendError, send400 } from "../errors";
import { syncAllEntities } from "../services/entity-sync";

const baseAdminRoutes = createAdminRoutes({ queryFn: query });

export async function registerAdminRoutes(app: FastifyInstance): Promise<void> {
  // Register base admin routes from @puda/api-core
  await baseAdminRoutes(app);

  // Data export with mandatory justification
  app.post("/api/v1/admin/export", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["exportType", "justification"],
        properties: {
          exportType: { type: "string" },
          filters: { type: "object" },
          justification: { type: "string", minLength: 10 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { exportType, filters, justification } = request.body as {
        exportType: string;
        filters?: Record<string, unknown>;
        justification: string;
      };
      const { userId } = request.authUser!;

      if (!justification || justification.trim().length < 10) {
        return send400(reply, "JUSTIFICATION_REQUIRED", "Export justification must be at least 10 characters");
      }

      // Log the export with justification
      const result = await query(
        `INSERT INTO export_log (export_type, filters_jsonb, justification, created_by)
         VALUES ($1, $2, $3, $4)
         RETURNING export_id, export_type, justification, created_by, created_at`,
        [exportType, JSON.stringify(filters || {}), justification, userId],
      );

      return { export: result.rows[0], message: "Export initiated" };
    } catch (err: unknown) {
      request.log.error(err, "Failed to initiate export");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Sync JSONB data → normalized entity tables + rebuild graph
  app.post("/api/v1/admin/sync-entities", async (request, reply) => {
    try {
      const roles = request.authUser?.roles || [];
      if (!roles.some((r: string) => ["ADMINISTRATOR", "SUPERVISORY_OFFICER"].includes(r))) {
        return sendError(reply, 403, "FORBIDDEN", "Admin access required");
      }

      const stats = await syncAllEntities();
      return { success: true, stats };
    } catch (err: unknown) {
      request.log.error(err, "Entity sync failed");
      return sendError(reply, 500, "SYNC_FAILED", "Entity sync failed");
    }
  });
}
