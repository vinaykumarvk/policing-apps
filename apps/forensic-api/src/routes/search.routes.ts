import { FastifyInstance } from "fastify";
import { globalSearch, getSearchFacets } from "../services/search";
import { query } from "../db";
import { sendError } from "../errors";

export async function registerSearchRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/search", async (request, reply) => {
    try {
      const {
        q,
        fuzzy,
        transliterate: trans,
        limit: rawLimit,
        offset: rawOffset,
        entity_types,
        artifact_types,
        risk_bands,
        date_from,
        date_to,
      } = request.query as Record<string, string | undefined>;

      if (!q || q.trim().length === 0) {
        return sendError(reply, 400, "VALIDATION_ERROR", "Query parameter 'q' is required");
      }

      const limit = Math.min(parseInt(rawLimit || "20", 10) || 20, 100);
      const offset = Math.max(parseInt(rawOffset || "0", 10) || 0, 0);

      const results = await globalSearch({
        q,
        fuzzy: fuzzy === "true",
        transliterate: trans === "true",
        limit,
        offset,
        entityTypes: entity_types ? entity_types.split(",") : undefined,
        artifactTypes: artifact_types ? artifact_types.split(",") : undefined,
        riskBands: risk_bands ? risk_bands.split(",") : undefined,
        dateFrom: date_from,
        dateTo: date_to,
      });

      return results;
    } catch (err: unknown) {
      request.log.error(err, "Failed to execute search");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // GET /api/v1/search/facets — Facet counts for filtering
  app.get("/api/v1/search/facets", async (request, reply) => {
    try {
      const unitId = request.authUser?.unitId || undefined;
      const facets = await getSearchFacets(unitId);
      return { facets };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get search facets");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // GET /api/v1/search/gallery — Gallery-friendly evidence listing (FR-05)
  app.get("/api/v1/search/gallery", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          caseId: { type: "string", format: "uuid" },
          type: { type: "string", description: "Filter by source_type (image, video, document)" },
          page: { type: "integer", minimum: 1, default: 1 },
          limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const qs = request.query as { caseId?: string; type?: string; page?: number; limit?: number };
      const unitId = request.authUser?.unitId || null;
      const page = Math.max(qs.page || 1, 1);
      const limit = Math.min(Math.max(qs.limit || 20, 1), 100);
      const offset = (page - 1) * limit;

      const conditions: string[] = [];
      const params: unknown[] = [];
      let idx = 1;

      if (qs.caseId) {
        conditions.push(`e.case_id = $${idx++}`);
        params.push(qs.caseId);
      }
      if (qs.type) {
        conditions.push(`e.source_type = $${idx++}`);
        params.push(qs.type);
      }
      if (unitId) {
        conditions.push(`e.unit_id = $${idx++}`);
        params.push(unitId);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      const result = await query(
        `SELECT e.evidence_id, e.file_name, e.source_type AS mime_type, e.file_url AS thumbnail_url,
                e.created_at AS uploaded_at, c.title AS case_title,
                COUNT(*) OVER() AS total_count
         FROM evidence_source e
         JOIN forensic_case c ON c.case_id = e.case_id
         ${whereClause}
         ORDER BY e.created_at DESC
         LIMIT $${idx++} OFFSET $${idx++}`,
        [...params, limit, offset],
      );

      const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
      const items = result.rows.map(({ total_count, ...row }: any) => ({
        evidenceId: row.evidence_id,
        fileName: row.file_name,
        mimeType: row.mime_type,
        thumbnailUrl: row.thumbnail_url,
        uploadedAt: row.uploaded_at,
        caseTitle: row.case_title,
      }));

      return { items, total };
    } catch (err: unknown) {
      request.log.error(err, "Failed to fetch gallery view");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });
}
