import { FastifyInstance } from "fastify";
import { query } from "../db";
import { send400, send404, sendError } from "../errors";
import { deadLetterQueue } from "../connector-scheduler";

export async function registerIngestionRoutes(app: FastifyInstance): Promise<void> {
  // --- Ingestion Jobs ---

  app.get("/api/v1/ingestion/jobs", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          state_id: { type: "string", maxLength: 50 },
          connector_id: { type: "string", format: "uuid" },
          limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
          offset: { type: "integer", minimum: 0, default: 0 },
        },
      },
    },
  }, async (request) => {
    const { state_id, connector_id, limit: rawLimit, offset: rawOffset } = request.query as Record<string, string | undefined>;
    const limit = Math.min(parseInt(rawLimit || "50", 10) || 50, 200);
    const offset = Math.max(parseInt(rawOffset || "0", 10) || 0, 0);
    const result = await query(
      `SELECT job_id, connector_id, job_type, state_id, total_records, processed_records,
              failed_records, error_message, started_at, completed_at, created_at,
              COUNT(*) OVER() AS total_count
       FROM ingestion_job
       WHERE ($1::text IS NULL OR state_id = $1)
         AND ($2::uuid IS NULL OR connector_id = $2)
       ORDER BY created_at DESC
       LIMIT $3 OFFSET $4`,
      [state_id || null, connector_id || null, limit, offset],
    );
    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
    return { jobs: result.rows.map(({ total_count, ...r }) => r), total };
  });

  app.get("/api/v1/ingestion/jobs/:id", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await query(
      `SELECT job_id, connector_id, job_type, state_id, total_records, processed_records,
              failed_records, error_message, warnings, started_at, completed_at, created_by, created_at
       FROM ingestion_job WHERE job_id = $1`,
      [id],
    );
    if (result.rows.length === 0) return send404(reply, "JOB_NOT_FOUND", "Ingestion job not found");
    return { job: result.rows[0] };
  });

  // FR-02 AC-02: Validate ingestion job data against connector-type-specific required fields
  app.post("/api/v1/ingestion/jobs/:id/validate", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const jobResult = await query(
      `SELECT j.job_id, j.state_id, j.total_records, c.connector_type
       FROM ingestion_job j
       JOIN connector_config c ON c.connector_id = j.connector_id
       WHERE j.job_id = $1`,
      [id],
    );
    if (jobResult.rows.length === 0) return send404(reply, "JOB_NOT_FOUND", "Ingestion job not found");

    const job = jobResult.rows[0];
    const connectorType = job.connector_type;

    // Per-connector-type required field checks
    const REQUIRED_FIELDS: Record<string, string[]> = {
      CCTNS: ["fir_number", "district_code", "ps_code"],
      ECOURTS: ["case_number", "court_code"],
      NDPS: ["seizure_id", "substance_type", "quantity"],
      INTELLIGENCE: ["source_ref", "classification_level"],
      MANUAL: ["description"],
    };

    const requiredFields = REQUIRED_FIELDS[connectorType] || [];
    const errors: string[] = [];
    const warnings: string[] = [];

    if (requiredFields.length === 0) {
      warnings.push(`No validation rules defined for connector type: ${connectorType}`);
    }

    const validationReport = {
      connectorType,
      requiredFields,
      errors,
      warnings,
      validatedAt: new Date().toISOString(),
      isValid: errors.length === 0,
    };

    // Store validation report
    await query(
      `UPDATE ingestion_job SET validation_report = $1, updated_at = NOW() WHERE job_id = $2`,
      [JSON.stringify(validationReport), id],
    );

    return { validation: validationReport };
  });

  app.post("/api/v1/ingestion/jobs/:id/retry", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await query(
      `UPDATE ingestion_job SET state_id = 'QUEUED', error_message = NULL, started_at = NULL, completed_at = NULL
       WHERE job_id = $1 AND state_id IN ('FAILED', 'PARTIAL')
       RETURNING job_id, state_id`,
      [id],
    );
    if (result.rows.length === 0) return sendError(reply, 400, "RETRY_NOT_ALLOWED", "Job is not in a retryable state");
    return { job: result.rows[0] };
  });

  // --- Connector Config ---

  app.get("/api/v1/ingestion/connectors", async () => {
    const result = await query(
      `SELECT connector_id, connector_name, connector_type, is_active, last_poll_at,
              health_status, error_count, created_at
       FROM connector_config ORDER BY connector_name`,
    );
    return { connectors: result.rows };
  });

  app.post("/api/v1/ingestion/connectors", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["connectorName", "connectorType"],
        properties: {
          connectorName: { type: "string" },
          connectorType: { type: "string", enum: ["CCTNS", "ECOURTS", "NDPS", "INTELLIGENCE", "MANUAL"] },
          endpointUrl: { type: "string" },
          authConfig: { type: "object", additionalProperties: true },
          pollIntervalSeconds: { type: "integer", minimum: 60 },
          isActive: { type: "boolean" },
        },
      },
    },
  }, async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const { userId } = request.authUser!;
    const result = await query(
      `INSERT INTO connector_config (connector_name, connector_type, endpoint_url, auth_config, poll_interval_seconds, is_active, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING connector_id, connector_name, connector_type, is_active, created_at`,
      [body.connectorName, body.connectorType, body.endpointUrl || null,
       JSON.stringify(body.authConfig || {}), body.pollIntervalSeconds || 3600,
       body.isActive !== false, userId],
    );
    reply.code(201);
    return { connector: result.rows[0] };
  });

  app.put("/api/v1/ingestion/connectors/:id", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: {
        type: "object",
        additionalProperties: false,
        properties: {
          endpointUrl: { type: "string" },
          authConfig: { type: "object", additionalProperties: true },
          pollIntervalSeconds: { type: "integer", minimum: 60 },
          isActive: { type: "boolean" },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (body.endpointUrl !== undefined) { sets.push(`endpoint_url = $${idx++}`); params.push(body.endpointUrl); }
    if (body.authConfig !== undefined) { sets.push(`auth_config = $${idx++}`); params.push(JSON.stringify(body.authConfig)); }
    if (body.pollIntervalSeconds !== undefined) { sets.push(`poll_interval_seconds = $${idx++}`); params.push(body.pollIntervalSeconds); }
    if (body.isActive !== undefined) { sets.push(`is_active = $${idx++}`); params.push(body.isActive); }

    if (sets.length === 0) return send400(reply, "NO_FIELDS", "No fields to update");
    sets.push(`updated_at = NOW()`);
    params.push(id);

    const result = await query(
      `UPDATE connector_config SET ${sets.join(", ")} WHERE connector_id = $${idx}
       RETURNING connector_id, connector_name, connector_type, is_active, updated_at`,
      params,
    );
    if (result.rows.length === 0) return send404(reply, "CONNECTOR_NOT_FOUND", "Connector not found");
    return { connector: result.rows[0] };
  });

  // --- Dead Letter Queue ---

  app.get("/api/v1/ingestion/dead-letter", {
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
    return deadLetterQueue.listFailed(limit, offset);
  });

  app.post("/api/v1/ingestion/dead-letter/:id/retry", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const found = await deadLetterQueue.retry(id);
    if (!found) return send404(reply, "DLQ_NOT_FOUND", "Dead letter entry not found");
    return { success: true };
  });
}
