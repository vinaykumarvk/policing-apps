import { FastifyInstance } from "fastify";
import { query } from "../db";
import { sendError, send404 } from "../errors";

export async function registerEarlyWarningRoutes(app: FastifyInstance): Promise<void> {

  // GET /api/v1/early-warning/trends — Get trend time-series data
  app.get("/api/v1/early-warning/trends", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          termType: { type: "string", maxLength: 50 },
          termValue: { type: "string", maxLength: 200 },
          hoursBack: { type: "integer", minimum: 1, maximum: 720, default: 24 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { termType, termValue, hoursBack } = request.query as {
        termType?: string; termValue?: string; hoursBack?: number;
      };
      const hours = hoursBack ?? 24;

      const result = await query(
        `SELECT td.detection_id, td.term_type, td.term_value, td.occurrence_count,
                td.trend_direction, td.baseline_count, td.deviation_pct,
                td.window_start, td.window_end, td.created_at
         FROM trend_detection td
         WHERE td.created_at >= NOW() - ($1 || ' hours')::interval
           AND ($2::text IS NULL OR td.term_type = $2)
           AND ($3::text IS NULL OR td.term_value ILIKE '%' || $3 || '%')
         ORDER BY td.created_at DESC
         LIMIT 500`,
        [hours, termType || null, termValue || null],
      );

      return { trends: result.rows };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get trend data");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // GET /api/v1/early-warning/spikes — Get unacknowledged spike alerts
  app.get("/api/v1/early-warning/spikes", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 200, default: 100 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { limit: rawLimit } = request.query as { limit?: number };
      const limit = Math.min(rawLimit ?? 100, 200);
      const result = await query(
        `SELECT * FROM trend_spike_alert WHERE acknowledged = FALSE ORDER BY created_at DESC LIMIT $1`,
        [limit],
      );
      return { spikes: result.rows };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get spike alerts");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // POST /api/v1/early-warning/spikes/:id/acknowledge — Acknowledge a spike
  app.post("/api/v1/early-warning/spikes/:id/acknowledge", {
    schema: {
      params: {
        type: "object",
        additionalProperties: false,
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
    },
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

  // GET /api/v1/early-warning/nps — Get NPS candidate queue
  app.get("/api/v1/early-warning/nps", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          status: { type: "string", enum: ["PENDING", "CONFIRMED_NPS", "REJECTED"], default: "PENDING" },
        },
      },
    },
  }, async (request, reply) => {
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

  // PATCH /api/v1/early-warning/nps/:id — Review NPS candidate
  app.patch("/api/v1/early-warning/nps/:id", {
    schema: {
      params: {
        type: "object",
        additionalProperties: false,
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
      body: {
        type: "object",
        additionalProperties: false,
        required: ["status"],
        properties: {
          status: { type: "string", enum: ["CONFIRMED_NPS", "REJECTED"] },
          category: { type: "string", maxLength: 100 },
        },
      },
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

  // GET /api/v1/early-warning/shared-trends — Cross-jurisdiction shared trends
  app.get("/api/v1/early-warning/shared-trends", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          hoursBack: { type: "integer", minimum: 1, maximum: 720, default: 48 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const unitId = request.authUser?.unitId || null;
      const { hoursBack } = request.query as { hoursBack?: number };
      const hours = hoursBack ?? 48;

      const result = await query(
        `SELECT td.detection_id, td.term_type, td.term_value, td.occurrence_count,
                td.trend_direction, td.deviation_pct, td.window_start, td.window_end,
                td.unit_id, ou.name AS unit_name
         FROM trend_detection td
         LEFT JOIN organization_unit ou ON ou.unit_id = td.unit_id
         WHERE td.created_at >= NOW() - ($1 || ' hours')::interval
           AND ($2::uuid IS NULL OR td.unit_id != $2)
           AND td.deviation_pct > 50
         ORDER BY td.deviation_pct DESC
         LIMIT 100`,
        [hours, unitId],
      );

      return { sharedTrends: result.rows };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get shared trends");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });
}
