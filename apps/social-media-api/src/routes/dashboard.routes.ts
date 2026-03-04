import { FastifyInstance } from "fastify";
import { query } from "../db";
import { sendError } from "../errors";

export async function registerDashboardRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/dashboard/stats", async (request, reply) => {
    try {
      const unitId = request.authUser?.unitId || null;
      const [alertsByState, casesTotal, contentTotal, watchlistsActive, recentAlerts] = await Promise.all([
        query(`SELECT state_id, COUNT(*)::int AS count FROM sm_alert WHERE ($1::uuid IS NULL OR unit_id = $1::uuid) GROUP BY state_id`, [unitId]),
        query(`SELECT COUNT(*)::int AS total FROM case_record WHERE ($1::uuid IS NULL OR unit_id = $1::uuid)`, [unitId]),
        query(`SELECT COUNT(*)::int AS total FROM content_item`, []),
        query(`SELECT COUNT(*)::int AS total FROM watchlist WHERE is_active = TRUE`, []),
        query(`SELECT alert_id, title, priority, state_id, created_at FROM sm_alert WHERE ($1::uuid IS NULL OR unit_id = $1::uuid) ORDER BY created_at DESC LIMIT 5`, [unitId]),
      ]);

      return {
        alertsByState: alertsByState.rows,
        totalCases: casesTotal.rows[0]?.total || 0,
        totalContent: contentTotal.rows[0]?.total || 0,
        activeWatchlists: watchlistsActive.rows[0]?.total || 0,
        recentAlerts: recentAlerts.rows,
      };
    } catch (err: unknown) {
      request.log.error(err, "Failed to fetch dashboard stats");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });
}
