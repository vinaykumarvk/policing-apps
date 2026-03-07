import { FastifyInstance } from "fastify";
import { query } from "../db";
import { sendError, send400, send404 } from "../errors";
import { executeImport } from "../services/import-executor";
import { listParsers } from "../parsers/parser-registry";

export async function registerImportRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/imports", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          state_id: { type: "string", maxLength: 100 },
          limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
          offset: { type: "integer", minimum: 0, default: 0 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { state_id, limit: rawLimit, offset: rawOffset } = request.query as Record<string, string | undefined>;
      const limit = Math.min(Math.max(parseInt(rawLimit || "50", 10) || 50, 1), 200);
      const offset = Math.max(parseInt(rawOffset || "0", 10) || 0, 0);

      const result = await query(
        `SELECT import_job_id, case_id, evidence_id, job_type, state_id,
                progress_pct, started_at, completed_at, created_at,
                COUNT(*) OVER() AS total_count
         FROM import_job
         WHERE ($1::text IS NULL OR state_id = $1)
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [state_id || null, limit, offset],
      );
      const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
      return { imports: result.rows.map(({ total_count, ...r }) => r), total };
    } catch (err: unknown) {
      request.log.error(err, "Failed to list imports");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  app.get("/api/v1/imports/facets", async () => {
    const stateRows = await query(`SELECT state_id AS value, COUNT(*)::int AS count FROM import_job GROUP BY state_id ORDER BY count DESC`, []);
    return { facets: { state_id: stateRows.rows } };
  });

  app.get("/api/v1/imports/:id", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const result = await query(
        `SELECT import_job_id, case_id, evidence_id, job_type, state_id, row_version,
                progress_pct, error_message, warnings, started_at, completed_at, created_at, updated_at
         FROM import_job WHERE import_job_id = $1`,
        [id],
      );
      if (result.rows.length === 0) {
        return send404(reply, "IMPORT_NOT_FOUND", "Import job not found");
      }
      return { import: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get import job");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // POST /api/v1/imports — Create import job with Idempotency-Key header
  app.post("/api/v1/imports", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["caseId", "parserType"],
        properties: {
          caseId: { type: "string", format: "uuid" },
          evidenceId: { type: "string", format: "uuid" },
          parserType: { type: "string" },
          jobType: { type: "string", enum: ["FULL_SYNC", "INCREMENTAL", "MANUAL_UPLOAD"] },
          expectedChecksum: { type: "string" },
          fileContent: { type: "string" },
          filename: { type: "string" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const idempotencyKey = request.headers["idempotency-key"] as string | undefined;

      // Check idempotency key
      if (idempotencyKey) {
        const existing = await query(
          `SELECT import_job_id, state_id FROM import_job WHERE idempotency_key = $1`,
          [idempotencyKey],
        );
        if (existing.rows.length > 0) {
          return { import: existing.rows[0], duplicate: true };
        }
      }

      const result = await query(
        `INSERT INTO import_job (case_id, evidence_id, job_type, parser_type, idempotency_key)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING import_job_id, case_id, evidence_id, job_type, parser_type, state_id, created_at`,
        [body.caseId, body.evidenceId || null, body.jobType || "MANUAL_UPLOAD",
         body.parserType, idempotencyKey || null],
      );
      reply.code(201);
      return { import: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to create import job");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // POST /api/v1/imports/:id/execute — Trigger parser execution
  app.post("/api/v1/imports/:id/execute", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: {
        type: "object",
        additionalProperties: false,
        properties: {
          fileContent: { type: "string" },
          filename: { type: "string" },
          expectedChecksum: { type: "string" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;

      const jobResult = await query(
        `SELECT import_job_id, case_id, evidence_id, parser_type, state_id, idempotency_key
         FROM import_job WHERE import_job_id = $1`,
        [id],
      );
      if (jobResult.rows.length === 0) return send404(reply, "IMPORT_NOT_FOUND", "Import job not found");

      const job = jobResult.rows[0];
      if (job.state_id !== "QUEUED") {
        return send400(reply, "INVALID_STATE", "Import job must be in QUEUED state to execute");
      }

      const fileData = body.fileContent
        ? Buffer.from(body.fileContent as string, "base64")
        : Buffer.alloc(0);

      const result = await executeImport(
        id, fileData, (body.filename as string) || "unknown",
        job.parser_type, job.case_id, job.evidence_id,
        job.idempotency_key, body.expectedChecksum as string | undefined,
      );

      return { result };
    } catch (err: unknown) {
      request.log.error(err, "Failed to execute import");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // GET /api/v1/imports/quarantine — View quarantined jobs
  app.get("/api/v1/imports/quarantine", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
          offset: { type: "integer", minimum: 0, default: 0 },
        },
      },
    },
  }, async (request) => {
    const { limit: rawLimit, offset: rawOffset } = request.query as Record<string, string | undefined>;
    const limit = Math.min(parseInt(rawLimit || "50", 10) || 50, 200);
    const offset = Math.max(parseInt(rawOffset || "0", 10) || 0, 0);
    const result = await query(
      `SELECT import_job_id, case_id, parser_type, quarantine_reason, checksum_sha256, created_at,
              COUNT(*) OVER() AS total_count
       FROM import_job WHERE quarantine_reason IS NOT NULL
       ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
    return { quarantined: result.rows.map(({ total_count, ...r }) => r), total };
  });

  // GET /api/v1/parsers — List available parsers
  app.get("/api/v1/parsers", async () => {
    const parsers = await listParsers();
    return { parsers };
  });
}
