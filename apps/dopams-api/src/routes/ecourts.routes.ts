import { FastifyInstance } from "fastify";
import { query } from "../db";
import { send400, send404, sendError } from "../errors";
import { syncCourtCase } from "../services/ecourts-poller";

export async function registerEcourtsRoutes(
  app: FastifyInstance,
): Promise<void> {
  // -------------------------------------------------------------------------
  // GET /api/v1/court-cases — paginated list
  // -------------------------------------------------------------------------
  app.get(
    "/api/v1/court-cases",
    {
      schema: {
        tags: ["ecourts"],
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            subject_id: { type: "string", format: "uuid" },
            legal_status: { type: "string", maxLength: 50 },
            review_status: { type: "string", maxLength: 20 },
            limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
            offset: { type: "integer", minimum: 0, default: 0 },
          },
        },
      },
    },
    async (request) => {
      const {
        subject_id,
        legal_status,
        review_status,
        limit: rawLimit,
        offset: rawOffset,
      } = request.query as Record<string, string | undefined>;

      const limit = Math.min(
        Math.max(parseInt(rawLimit || "50", 10) || 50, 1),
        200,
      );
      const offset = Math.max(parseInt(rawOffset || "0", 10) || 0, 0);

      const result = await query(
        `SELECT court_case_id, subject_id, case_id, cnr_number, case_number,
                court_name, case_type, filing_date, next_hearing_date,
                legal_status, confidence_score, review_status,
                last_synced_at, created_at,
                COUNT(*) OVER() AS total_count
         FROM court_case
         WHERE ($1::uuid IS NULL OR subject_id = $1::uuid)
           AND ($2::text IS NULL OR legal_status = $2)
           AND ($5::text IS NULL OR review_status = $5)
         ORDER BY next_hearing_date ASC NULLS LAST, created_at DESC
         LIMIT $3 OFFSET $4`,
        [subject_id || null, legal_status || null, limit, offset, review_status || null],
      );

      const total =
        result.rows.length > 0
          ? parseInt(String(result.rows[0].total_count), 10)
          : 0;

      return {
        courtCases: result.rows.map(({ total_count: _, ...r }) => r),
        total,
        limit,
        offset,
      };
    },
  );

  // -------------------------------------------------------------------------
  // GET /api/v1/court-cases/:id — single court case
  // -------------------------------------------------------------------------
  app.get(
    "/api/v1/court-cases/:id",
    {
      schema: {
        tags: ["ecourts"],
        params: {
          type: "object",
          additionalProperties: false,
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const result = await query(
        `SELECT cc.*, sp.name AS subject_name, dc.case_number AS linked_case_number
         FROM court_case cc
         LEFT JOIN subject_profile sp ON sp.subject_id = cc.subject_id
         LEFT JOIN dopams_case dc ON dc.case_id = cc.case_id
         WHERE cc.court_case_id = $1`,
        [id],
      );

      if (result.rows.length === 0) {
        return send404(reply, "COURT_CASE_NOT_FOUND", "Court case not found");
      }

      return { courtCase: result.rows[0] };
    },
  );

  // -------------------------------------------------------------------------
  // POST /api/v1/court-cases — create a new court case
  // FR-06: Accepts confidenceScore; routes to AMBIGUOUS if confidence < 0.6
  // -------------------------------------------------------------------------
  app.post(
    "/api/v1/court-cases",
    {
      schema: {
        tags: ["ecourts"],
        body: {
          type: "object",
          additionalProperties: false,
          required: ["cnrNumber", "caseNumber", "courtName"],
          properties: {
            cnrNumber: { type: "string", minLength: 1, maxLength: 50 },
            caseNumber: { type: "string", minLength: 1, maxLength: 100 },
            courtName: { type: "string", minLength: 1, maxLength: 255 },
            subjectId: { type: "string", format: "uuid" },
            caseId: { type: "string", format: "uuid" },
            caseType: { type: "string", maxLength: 100 },
            filingDate: { type: "string", format: "date" },
            confidenceScore: { type: "number", minimum: 0, maximum: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const {
        cnrNumber,
        caseNumber,
        courtName,
        subjectId,
        caseId,
        caseType,
        filingDate,
        confidenceScore,
      } = request.body as {
        cnrNumber: string;
        caseNumber: string;
        courtName: string;
        subjectId?: string;
        caseId?: string;
        caseType?: string;
        filingDate?: string;
        confidenceScore?: number;
      };

      // FR-06: Route low-confidence matches to AMBIGUOUS for manual review
      const reviewStatus =
        confidenceScore !== undefined && confidenceScore < 0.6
          ? "AMBIGUOUS"
          : "AUTO_MATCHED";

      try {
        const result = await query(
          `INSERT INTO court_case
             (cnr_number, case_number, court_name, subject_id, case_id,
              case_type, filing_date, confidence_score, review_status)
           VALUES ($1, $2, $3, $4::uuid, $5::uuid, $6, $7::date, $8, $9)
           RETURNING *`,
          [
            cnrNumber,
            caseNumber,
            courtName,
            subjectId || null,
            caseId || null,
            caseType || null,
            filingDate || null,
            confidenceScore ?? null,
            reviewStatus,
          ],
        );

        reply.code(201);
        return { courtCase: result.rows[0] };
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        if (errMsg.includes("unique") || errMsg.includes("duplicate")) {
          return send400(
            reply,
            "DUPLICATE_CNR",
            `A court case with CNR number '${cnrNumber}' already exists`,
          );
        }
        request.log.error(err, "Failed to create court case");
        return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
      }
    },
  );

  // -------------------------------------------------------------------------
  // POST /api/v1/court-cases/:id/sync — force-poll a single case
  // -------------------------------------------------------------------------
  app.post(
    "/api/v1/court-cases/:id/sync",
    {
      schema: {
        tags: ["ecourts"],
        params: {
          type: "object",
          additionalProperties: false,
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      // Look up the CNR number for this court case
      const lookupResult = await query(
        `SELECT cnr_number FROM court_case WHERE court_case_id = $1`,
        [id],
      );

      if (lookupResult.rows.length === 0) {
        return send404(reply, "COURT_CASE_NOT_FOUND", "Court case not found");
      }

      const cnrNumber = lookupResult.rows[0].cnr_number as string | null;
      if (!cnrNumber) {
        return send400(
          reply,
          "MISSING_CNR",
          "This court case has no CNR number and cannot be synced with eCourts",
        );
      }

      try {
        const updated = await syncCourtCase(cnrNumber);
        if (!updated) {
          return sendError(
            reply,
            502,
            "ECOURTS_NOT_FOUND",
            `Case with CNR '${cnrNumber}' was not found in eCourts`,
          );
        }
        return { courtCase: updated };
      } catch (err: unknown) {
        request.log.error(err, "eCourts sync failed");
        return sendError(
          reply,
          502,
          "ECOURTS_SYNC_FAILED",
          "Failed to sync case with eCourts",
        );
      }
    },
  );
}
