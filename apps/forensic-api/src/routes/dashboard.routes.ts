import { FastifyInstance } from "fastify";
import { query } from "../db";
import { sendError } from "../errors";

export async function registerDashboardRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/dashboard/stats", async (request, reply) => {
    try {
      const unitId = request.authUser?.unitId || null;
      const [casesByState, casesByType, evidenceTotal, pendingFindings, draftReports, recentCases] = await Promise.all([
        query(`SELECT state_id, COUNT(*)::int AS count FROM forensic_case WHERE ($1::text IS NULL OR unit_id = $1) GROUP BY state_id`, [unitId]),
        query(`SELECT case_type, COUNT(*)::int AS count FROM forensic_case WHERE ($1::text IS NULL OR unit_id = $1) GROUP BY case_type`, [unitId]),
        query(`SELECT COUNT(*)::int AS total FROM evidence_source WHERE ($1::text IS NULL OR unit_id = $1)`, [unitId]),
        query(`SELECT COUNT(*)::int AS total FROM ai_finding WHERE state_id = 'UNREVIEWED' AND ($1::text IS NULL OR unit_id = $1)`, [unitId]),
        query(`SELECT COUNT(*)::int AS total FROM report WHERE state_id = 'DRAFT' AND ($1::text IS NULL OR unit_id = $1)`, [unitId]),
        query(`SELECT case_id, case_number, title, case_type, state_id, priority, created_at FROM forensic_case WHERE ($1::text IS NULL OR unit_id = $1) ORDER BY created_at DESC LIMIT 5`, [unitId]),
      ]);

      return {
        casesByState: casesByState.rows,
        casesByType: casesByType.rows,
        totalEvidence: evidenceTotal.rows[0]?.total || 0,
        pendingFindings: pendingFindings.rows[0]?.total || 0,
        draftReports: draftReports.rows[0]?.total || 0,
        recentCases: recentCases.rows,
      };
    } catch (err: unknown) {
      request.log.error(err, "Failed to fetch dashboard stats");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });
}
