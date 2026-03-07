import { FastifyInstance } from "fastify";
import { query } from "../db";
import { send400, send404, sendError } from "../errors";
import {
  analyzeCDR,
  detectStayLocations,
  buildRouteMap,
  createAnalysisJob,
  getAnalysisJob,
  listAnalysisJobs,
} from "../services/cdr-analysis";

export async function registerCdrRoutes(app: FastifyInstance): Promise<void> {
  const uuidParam = {
    type: "object" as const,
    additionalProperties: false,
    required: ["id"],
    properties: { id: { type: "string" as const, format: "uuid" } },
  };

  // GET /api/v1/cdr/subjects/:id/analysis — CDR analysis for a subject
  app.get("/api/v1/cdr/subjects/:id/analysis", {
    schema: { params: uuidParam },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const analysis = await analyzeCDR(id);
      return analysis;
    } catch (err: unknown) {
      request.log.error(err, "CDR analysis failed");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // POST /api/v1/cdr/subjects/:id/stay-locations — Detect stay locations
  app.post("/api/v1/cdr/subjects/:id/stay-locations", {
    schema: {
      params: uuidParam,
      body: {
        type: "object",
        additionalProperties: false,
        properties: {
          minDurationMinutes: { type: "integer", minimum: 1, default: 30 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { minDurationMinutes } = (request.body || {}) as { minDurationMinutes?: number };
      const stays = await detectStayLocations(id, minDurationMinutes);
      return { stayLocations: stays, count: stays.length };
    } catch (err: unknown) {
      request.log.error(err, "Stay location detection failed");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // GET /api/v1/cdr/subjects/:id/stay-locations — List stored stay locations
  app.get("/api/v1/cdr/subjects/:id/stay-locations", {
    schema: { params: uuidParam },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const result = await query(
      `SELECT stay_id, latitude, longitude, radius_meters, stay_start, stay_end, tower_ids, cdr_count, label, created_at
       FROM stay_location WHERE subject_id = $1 ORDER BY stay_start DESC`,
      [id],
    );
    return { stayLocations: result.rows };
  });

  // GET /api/v1/cdr/subjects/:id/route-map — Route map over time range
  app.get("/api/v1/cdr/subjects/:id/route-map", {
    schema: {
      params: uuidParam,
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          from: { type: "string", format: "date-time" },
          to: { type: "string", format: "date-time" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { from, to } = request.query as { from?: string; to?: string };
      const route = await buildRouteMap(id, from, to);
      return { route, pointCount: route.length };
    } catch (err: unknown) {
      request.log.error(err, "Route map build failed");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // POST /api/v1/cdr/upload — Bulk upload CDR records
  app.post("/api/v1/cdr/upload", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["records"],
        properties: {
          subjectId: { type: "string", format: "uuid" },
          sourceFile: { type: "string" },
          records: {
            type: "array",
            maxItems: 10000,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["callingNumber", "calledNumber", "callStart"],
              properties: {
                callingNumber: { type: "string" },
                calledNumber: { type: "string" },
                callType: { type: "string", enum: ["VOICE", "SMS", "DATA", "MMS"] },
                callStart: { type: "string", format: "date-time" },
                callEnd: { type: "string", format: "date-time" },
                durationSeconds: { type: "integer", minimum: 0 },
                callingTowerCode: { type: "string" },
                calledTowerCode: { type: "string" },
                imei: { type: "string" },
                imsi: { type: "string" },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const body = request.body as {
        subjectId?: string;
        sourceFile?: string;
        records: Array<{
          callingNumber: string;
          calledNumber: string;
          callType?: string;
          callStart: string;
          callEnd?: string;
          durationSeconds?: number;
          callingTowerCode?: string;
          calledTowerCode?: string;
          imei?: string;
          imsi?: string;
        }>;
      };

      let inserted = 0;
      for (const rec of body.records) {
        // Resolve tower codes to IDs
        let callingTowerId = null;
        let calledTowerId = null;
        if (rec.callingTowerCode) {
          const t = await query(`SELECT tower_id FROM tower_location WHERE tower_code = $1`, [rec.callingTowerCode]);
          if (t.rows.length > 0) callingTowerId = t.rows[0].tower_id;
        }
        if (rec.calledTowerCode) {
          const t = await query(`SELECT tower_id FROM tower_location WHERE tower_code = $1`, [rec.calledTowerCode]);
          if (t.rows.length > 0) calledTowerId = t.rows[0].tower_id;
        }

        await query(
          `INSERT INTO cdr_record (subject_id, calling_number, called_number, call_type, call_start, call_end,
                                    duration_seconds, calling_tower_id, called_tower_id, imei, imsi, source_file)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            body.subjectId || null, rec.callingNumber, rec.calledNumber,
            rec.callType || "VOICE", rec.callStart, rec.callEnd || null,
            rec.durationSeconds || 0, callingTowerId, calledTowerId,
            rec.imei || null, rec.imsi || null, body.sourceFile || null,
          ],
        );
        inserted++;
      }

      reply.code(201);
      return { success: true, inserted };
    } catch (err: unknown) {
      request.log.error(err, "CDR upload failed");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Tower management
  app.get("/api/v1/cdr/towers", async (request) => {
    const result = await query(
      `SELECT tower_id, tower_code, latitude, longitude, address, operator, sector_count, created_at
       FROM tower_location ORDER BY tower_code`,
    );
    return { towers: result.rows };
  });

  app.post("/api/v1/cdr/towers", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["towerCode", "latitude", "longitude"],
        properties: {
          towerCode: { type: "string" },
          latitude: { type: "number" },
          longitude: { type: "number" },
          address: { type: "string" },
          operator: { type: "string" },
          sectorCount: { type: "integer", minimum: 1 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const body = request.body as {
        towerCode: string; latitude: number; longitude: number;
        address?: string; operator?: string; sectorCount?: number;
      };
      const result = await query(
        `INSERT INTO tower_location (tower_code, latitude, longitude, address, operator, sector_count)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [body.towerCode, body.latitude, body.longitude, body.address || null, body.operator || null, body.sectorCount || 3],
      );
      reply.code(201);
      return { tower: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Tower creation failed");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Analysis jobs
  app.get("/api/v1/analysis-jobs", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          state_id: { type: "string", maxLength: 50 },
          limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
          offset: { type: "integer", minimum: 0, default: 0 },
        },
      },
    },
  }, async (request) => {
    const { state_id, limit: rawLimit, offset: rawOffset } = request.query as Record<string, string | undefined>;
    const limit = Math.min(parseInt(rawLimit || "50", 10) || 50, 200);
    const offset = Math.max(parseInt(rawOffset || "0", 10) || 0, 0);
    return listAnalysisJobs(state_id, limit, offset);
  });

  app.get("/api/v1/analysis-jobs/:id", {
    schema: { params: uuidParam },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const job = await getAnalysisJob(id);
    if (!job) return send404(reply, "JOB_NOT_FOUND", "Analysis job not found");
    return { job };
  });

  app.post("/api/v1/analysis-jobs", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["jobType"],
        properties: {
          jobType: { type: "string", enum: ["CDR_ANALYSIS", "ROUTE_MAP", "STAY_DETECTION", "GRAPH_ANALYSIS"] },
          subjectId: { type: "string", format: "uuid" },
          parameters: { type: "object", additionalProperties: true },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { jobType, subjectId, parameters } = request.body as {
        jobType: string; subjectId?: string; parameters?: Record<string, unknown>;
      };
      const { userId } = request.authUser!;
      const job = await createAnalysisJob(jobType, subjectId || null, parameters || {}, userId);
      reply.code(201);
      return { job };
    } catch (err: unknown) {
      request.log.error(err, "Failed to create analysis job");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });
}
