import { FastifyInstance } from "fastify";
import { query } from "../db";
import { sendError } from "../errors";

export async function registerDashboardRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/dashboard/stats", async (request, reply) => {
    try {
      const unitId = request.authUser?.unitId || null;
      const [alertsBySeverity, leadsByState, casesTotal, subjectsTotal, recentAlerts] = await Promise.all([
        query(`SELECT severity, COUNT(*)::int AS count FROM alert WHERE ($1::uuid IS NULL OR unit_id = $1::uuid) GROUP BY severity`, [unitId]),
        query(`SELECT state_id, COUNT(*)::int AS count FROM lead WHERE ($1::uuid IS NULL OR unit_id = $1::uuid) GROUP BY state_id`, [unitId]),
        query(`SELECT COUNT(*)::int AS total FROM dopams_case WHERE ($1::uuid IS NULL OR unit_id = $1::uuid)`, [unitId]),
        query(`SELECT COUNT(*)::int AS total FROM subject_profile WHERE ($1::uuid IS NULL OR unit_id = $1::uuid)`, [unitId]),
        query(`SELECT alert_id, title, severity, state_id, created_at FROM alert WHERE ($1::uuid IS NULL OR unit_id = $1::uuid) ORDER BY created_at DESC LIMIT 5`, [unitId]),
      ]);

      return {
        alertsBySeverity: alertsBySeverity.rows,
        leadsByState: leadsByState.rows,
        totalCases: casesTotal.rows[0]?.total || 0,
        totalSubjects: subjectsTotal.rows[0]?.total || 0,
        recentAlerts: recentAlerts.rows,
      };
    } catch (err: unknown) {
      request.log.error(err, "Failed to fetch dashboard stats");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });
}
