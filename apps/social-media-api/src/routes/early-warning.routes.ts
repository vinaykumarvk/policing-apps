import { FastifyInstance } from "fastify";
import { query } from "../db";
import { sendError, send404 } from "../errors";
import { getTrendData } from "../services/trend-analyzer";
import { getSharedTrends } from "../services/trend-sharing";

export async function registerEarlyWarningRoutes(app: FastifyInstance): Promise<void> {

  // Get trend time-series data
  app.get("/api/v1/early-warning/trends", async (request, reply) => {
    try {
      const { termType, termValue, hoursBack } = request.query as {
        termType?: string; termValue?: string; hoursBack?: string;
      };
      const data = await getTrendData({ termType, termValue, hoursBack: hoursBack ? Number(hoursBack) : undefined });
      return { trends: data };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get trend data");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Get unacknowledged spike alerts
  app.get("/api/v1/early-warning/spikes", async (request, reply) => {
    try {
      const result = await query(
        `SELECT * FROM trend_spike_alert WHERE acknowledged = FALSE ORDER BY created_at DESC LIMIT 100`,
      );
      return { spikes: result.rows };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get spike alerts");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Acknowledge a spike
  app.post("/api/v1/early-warning/spikes/:id/acknowledge", {
    schema: { params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { userId } = request.authUser!;
      const result = await query(
        `UPDATE trend_spike_alert SET acknowledged = TRUE, acknowledged_by = $2, acknowledged_at = NOW()
         WHERE spike_id = $1 AND acknowledged = FALSE RETURNING spike_id`,
        [id, userId],
      );
      if (result.rowCount === 0) return send404(reply, "NOT_FOUND", "Spike alert not found or already acknowledged");
      return { success: true };
    } catch (err: unknown) {
      request.log.error(err, "Failed to acknowledge spike");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Get NPS candidate queue
  app.get("/api/v1/early-warning/nps", async (request, reply) => {
    try {
      const { status } = request.query as { status?: string };
      const filterStatus = status || "PENDING";
      const result = await query(
        `SELECT * FROM nps_candidate WHERE status = $1 ORDER BY occurrence_count DESC`,
        [filterStatus],
      );
      return { candidates: result.rows };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get NPS candidates");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Review NPS candidate (confirm → auto-create slang_dictionary entry)
  app.patch("/api/v1/early-warning/nps/:id", {
    schema: {
      params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: { type: "object", required: ["status"], properties: { status: { type: "string" }, category: { type: "string" } } },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { status, category } = request.body as { status: string; category?: string };
      const { userId } = request.authUser!;

      const result = await query(
        `UPDATE nps_candidate SET status = $2, reviewed_by = $3, reviewed_at = NOW(), updated_at = NOW()
         WHERE nps_id = $1 RETURNING *`,
        [id, status, userId],
      );
      if (result.rowCount === 0) return send404(reply, "NOT_FOUND", "NPS candidate not found");

      // If confirmed as NPS, auto-create slang dictionary entry
      if (status === "CONFIRMED_NPS") {
        const candidate = result.rows[0];
        await query(
          `INSERT INTO slang_dictionary (term, normalized_form, language, category, risk_weight, submission_status, submitted_by)
           VALUES ($1, $1, 'en', $2, 5, 'APPROVED', $3)
           ON CONFLICT DO NOTHING`,
          [candidate.term, category || "NEW_PSYCHOACTIVE_SUBSTANCE", userId],
        );
      }

      return { candidate: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to review NPS candidate");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Cross-jurisdiction shared trends
  app.get("/api/v1/early-warning/shared-trends", async (request, reply) => {
    try {
      const unitId = request.authUser?.unitId;
      const trends = await getSharedTrends(unitId || undefined);
      return { sharedTrends: trends };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get shared trends");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });
}
