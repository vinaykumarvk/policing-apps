import { FastifyInstance } from "fastify";
import { query } from "../db";
import { send400, send404, sendError } from "../errors";

export async function registerSlangRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/v1/slang — List slang dictionary entries
  app.get("/api/v1/slang", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          category: { type: "string", maxLength: 100 },
          language: { type: "string", maxLength: 10 },
          submissionStatus: { type: "string", enum: ["PENDING", "APPROVED", "REJECTED"] },
          limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
          offset: { type: "integer", minimum: 0, default: 0 },
        },
      },
    },
  }, async (request) => {
    const qs = request.query as Record<string, string | undefined>;
    const limit = Math.min(parseInt(qs.limit || "50", 10) || 50, 200);
    const offset = Math.max(parseInt(qs.offset || "0", 10) || 0, 0);

    const result = await query(
      `SELECT slang_id, term, normalized_form, language, category, risk_weight, is_active,
              submission_status, submitted_by, reviewed_by, reviewed_at, created_at,
              COUNT(*) OVER() AS total_count
       FROM slang_dictionary
       WHERE ($1::text IS NULL OR category = $1)
         AND ($2::text IS NULL OR language = $2)
         AND ($3::text IS NULL OR submission_status = $3)
         AND is_active = TRUE
       ORDER BY category, term
       LIMIT $4 OFFSET $5`,
      [qs.category || null, qs.language || null, qs.submissionStatus || null, limit, offset],
    );
    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
    return { entries: result.rows.map(({ total_count, ...r }: any) => r), total };
  });

  // POST /api/v1/slang — Create entry (admin, auto-approved)
  app.post("/api/v1/slang", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["term", "normalizedForm", "category"],
        properties: {
          term: { type: "string" },
          normalizedForm: { type: "string" },
          language: { type: "string", maxLength: 10 },
          category: { type: "string" },
          riskWeight: { type: "number", minimum: 0, maximum: 10 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const { userId } = request.authUser!;
      const result = await query(
        `INSERT INTO slang_dictionary (term, normalized_form, language, category, risk_weight, submission_status, submitted_by, reviewed_by, reviewed_at)
         VALUES ($1, $2, $3, $4, $5, 'APPROVED', $6, $6, NOW())
         ON CONFLICT (term, language) DO UPDATE SET normalized_form = EXCLUDED.normalized_form, risk_weight = EXCLUDED.risk_weight, updated_at = NOW()
         RETURNING slang_id, term, normalized_form, language, category, risk_weight, submission_status, created_at`,
        [body.term, body.normalizedForm, body.language || "en", body.category, body.riskWeight || 1.0, userId],
      );
      reply.code(201);
      return { entry: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to create slang entry");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // POST /api/v1/slang/submit — User submission (PENDING status, needs admin review)
  app.post("/api/v1/slang/submit", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["term", "normalizedForm", "category"],
        properties: {
          term: { type: "string" },
          normalizedForm: { type: "string" },
          language: { type: "string", maxLength: 10 },
          category: { type: "string" },
          riskWeight: { type: "number", minimum: 0, maximum: 10 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const { userId } = request.authUser!;
      const result = await query(
        `INSERT INTO slang_dictionary (term, normalized_form, language, category, risk_weight, submission_status, submitted_by)
         VALUES ($1, $2, $3, $4, $5, 'PENDING', $6)
         RETURNING slang_id, term, normalized_form, language, category, risk_weight, submission_status, submitted_by, created_at`,
        [body.term, body.normalizedForm, body.language || "en", body.category, body.riskWeight || 1.0, userId],
      );
      reply.code(201);
      return { entry: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to submit slang entry");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // POST /api/v1/slang/:id/approve — Admin approves a pending entry
  app.post("/api/v1/slang/:id/approve", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { userId } = request.authUser!;
    const result = await query(
      `UPDATE slang_dictionary SET submission_status = 'APPROVED', reviewed_by = $1, reviewed_at = NOW(), updated_at = NOW()
       WHERE slang_id = $2 AND submission_status = 'PENDING'
       RETURNING slang_id, term, submission_status`,
      [userId, id],
    );
    if (result.rows.length === 0) return send404(reply, "NOT_FOUND", "Pending slang entry not found");
    return { entry: result.rows[0] };
  });

  // POST /api/v1/slang/:id/reject — Admin rejects a pending entry
  app.post("/api/v1/slang/:id/reject", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: { type: "object", additionalProperties: false, properties: { reason: { type: "string" } } },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { userId } = request.authUser!;
    const result = await query(
      `UPDATE slang_dictionary SET submission_status = 'REJECTED', reviewed_by = $1, reviewed_at = NOW(), updated_at = NOW()
       WHERE slang_id = $2 AND submission_status = 'PENDING'
       RETURNING slang_id, term, submission_status`,
      [userId, id],
    );
    if (result.rows.length === 0) return send404(reply, "NOT_FOUND", "Pending slang entry not found");
    return { entry: result.rows[0] };
  });

  // POST /api/v1/slang/bulk — Bulk import
  app.post("/api/v1/slang/bulk", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["entries"],
        properties: {
          entries: {
            type: "array",
            items: {
              type: "object",
              required: ["term", "normalizedForm", "category"],
              properties: {
                term: { type: "string" },
                normalizedForm: { type: "string" },
                language: { type: "string" },
                category: { type: "string" },
                riskWeight: { type: "number" },
              },
            },
            maxItems: 500,
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { entries } = request.body as { entries: Array<Record<string, unknown>> };
      let imported = 0;

      for (const entry of entries) {
        await query(
          `INSERT INTO slang_dictionary (term, normalized_form, language, category, risk_weight, submission_status)
           VALUES ($1, $2, $3, $4, $5, 'APPROVED')
           ON CONFLICT (term, language) DO UPDATE SET normalized_form = EXCLUDED.normalized_form, risk_weight = EXCLUDED.risk_weight, updated_at = NOW()`,
          [entry.term, entry.normalizedForm, entry.language || "en", entry.category, entry.riskWeight || 1.0],
        );
        imported++;
      }

      return { imported, total: entries.length };
    } catch (err: unknown) {
      request.log.error(err, "Failed to bulk import slang");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // DELETE /api/v1/slang/:id — Soft delete
  app.delete("/api/v1/slang/:id", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await query(
      `UPDATE slang_dictionary SET is_active = FALSE, updated_at = NOW() WHERE slang_id = $1
       RETURNING slang_id`,
      [id],
    );
    if (result.rows.length === 0) return send404(reply, "SLANG_NOT_FOUND", "Slang entry not found");
    return { success: true };
  });
}
