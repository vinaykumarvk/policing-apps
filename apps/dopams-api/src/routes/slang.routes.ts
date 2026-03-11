import { FastifyInstance } from "fastify";
import { query } from "../db";
import { send400, send404, sendError } from "../errors";
import { createRoleGuard } from "@puda/api-core";
import { validateSortColumn, validateSortDir } from "../services/entity-resolver";

const requireAdmin = createRoleGuard(["ADMINISTRATOR", "INTELLIGENCE_ANALYST"]);

const SLANG_SORT_ALLOWLIST = [
  "term", "normalized_form", "category", "language",
  "risk_weight", "submission_status", "created_at",
] as const;

export async function registerSlangRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/v1/slang — List slang dictionary entries (with sort, search, filter)
  app.get("/api/v1/slang", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          category: { type: "string", maxLength: 100 },
          language: { type: "string", maxLength: 10 },
          termType: { type: "string", enum: ["SLANG", "KEYWORD", "EMOJI"], maxLength: 20 },
          submissionStatus: { type: "string", enum: ["PENDING", "APPROVED", "REJECTED"] },
          search: { type: "string", maxLength: 200 },
          sortBy: { type: "string", maxLength: 30 },
          sortOrder: { type: "string", enum: ["asc", "desc"] },
          limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
          offset: { type: "integer", minimum: 0, default: 0 },
        },
      },
    },
  }, async (request) => {
    const qs = request.query as Record<string, string | undefined>;
    const limit = Math.min(parseInt(qs.limit || "50", 10) || 50, 200);
    const offset = Math.max(parseInt(qs.offset || "0", 10) || 0, 0);
    let sortCol: string;
    try {
      sortCol = validateSortColumn(qs.sortBy || "category", SLANG_SORT_ALLOWLIST);
    } catch {
      sortCol = "category";
    }
    const sortDir = validateSortDir(qs.sortOrder === "desc" ? "desc" : "asc");
    const searchTerm = qs.search ? `%${qs.search}%` : null;

    const result = await query(
      `SELECT slang_id, term, normalized_form, language, category, risk_weight, is_active,
              submission_status, submitted_by, reviewed_by, reviewed_at, created_at,
              COALESCE(term_type, 'SLANG') AS term_type,
              COUNT(*) OVER() AS total_count
       FROM slang_dictionary
       WHERE ($1::text IS NULL OR category = $1)
         AND ($2::text IS NULL OR language = $2)
         AND ($3::text IS NULL OR submission_status = $3)
         AND ($6::text IS NULL OR term ILIKE $6 OR normalized_form ILIKE $6)
         AND ($7::text IS NULL OR term_type = $7)
         AND is_active = TRUE
       ORDER BY ${sortCol} ${sortDir}, term ASC
       LIMIT $4 OFFSET $5`,
      [qs.category || null, qs.language || null, qs.submissionStatus || null, limit, offset, searchTerm, qs.termType || null],
    );
    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
    return { entries: result.rows.map(({ total_count, ...r }: any) => r), total };
  });

  // GET /api/v1/slang/facets — Distinct categories, languages, and term types
  app.get("/api/v1/slang/facets", async () => {
    const catResult = await query(
      `SELECT DISTINCT category FROM slang_dictionary WHERE is_active = TRUE ORDER BY category`,
    );
    const langResult = await query(
      `SELECT DISTINCT language FROM slang_dictionary WHERE is_active = TRUE ORDER BY language`,
    );
    const typeResult = await query(
      `SELECT DISTINCT COALESCE(term_type, 'SLANG') AS term_type FROM slang_dictionary WHERE is_active = TRUE ORDER BY term_type`,
    );
    return {
      categories: catResult.rows.map((r: any) => r.category),
      languages: langResult.rows.map((r: any) => r.language),
      term_types: typeResult.rows.map((r: any) => r.term_type),
    };
  });

  // POST /api/v1/slang — Create entry (admin, auto-approved)
  app.post("/api/v1/slang", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["term", "normalizedForm", "category"],
        properties: {
          term: { type: "string", minLength: 1 },
          normalizedForm: { type: "string", minLength: 1 },
          language: { type: "string", maxLength: 10 },
          category: { type: "string", minLength: 1 },
          riskWeight: { type: "number", minimum: 0, maximum: 10 },
          termType: { type: "string", enum: ["SLANG", "KEYWORD", "EMOJI"], default: "SLANG" },
        },
      },
    },
  }, async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    try {
      const body = request.body as Record<string, unknown>;
      const { userId } = request.authUser!;
      const result = await query(
        `INSERT INTO slang_dictionary (term, normalized_form, language, category, risk_weight, submission_status, submitted_by, reviewed_by, reviewed_at, term_type)
         VALUES ($1, $2, $3, $4, $5, 'APPROVED', $6, $6, NOW(), $7)
         ON CONFLICT (term, language) DO UPDATE SET normalized_form = EXCLUDED.normalized_form, risk_weight = EXCLUDED.risk_weight, updated_at = NOW()
         RETURNING slang_id, term, normalized_form, language, category, risk_weight, submission_status, created_at, COALESCE(term_type, 'SLANG') AS term_type`,
        [body.term, body.normalizedForm, body.language || "en", body.category, body.riskWeight || 1.0, userId, body.termType || "SLANG"],
      );
      reply.code(201);
      return { entry: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to create slang entry");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // PATCH /api/v1/slang/:id — Update an existing entry
  app.patch("/api/v1/slang/:id", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: {
        type: "object",
        additionalProperties: false,
        properties: {
          term: { type: "string" },
          normalizedForm: { type: "string" },
          language: { type: "string", maxLength: 10 },
          category: { type: "string" },
          riskWeight: { type: "number", minimum: 0, maximum: 10 },
          termType: { type: "string", enum: ["SLANG", "KEYWORD", "EMOJI"] },
        },
      },
    },
  }, async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;
    const result = await query(
      `UPDATE slang_dictionary
       SET term = COALESCE($2, term),
           normalized_form = COALESCE($3, normalized_form),
           language = COALESCE($4, language),
           category = COALESCE($5, category),
           risk_weight = COALESCE($6, risk_weight),
           term_type = COALESCE($7, term_type),
           updated_at = NOW()
       WHERE slang_id = $1 AND is_active = TRUE
       RETURNING slang_id, term, normalized_form, language, category, risk_weight, submission_status, created_at, COALESCE(term_type, 'SLANG') AS term_type`,
      [id, body.term ?? null, body.normalizedForm ?? null, body.language ?? null, body.category ?? null, body.riskWeight ?? null, body.termType ?? null],
    );
    if (result.rows.length === 0) return send404(reply, "NOT_FOUND", "Slang entry not found");
    return { entry: result.rows[0] };
  });

  // POST /api/v1/slang/submit — User submission (PENDING status, needs admin review)
  app.post("/api/v1/slang/submit", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["term", "normalizedForm", "category"],
        properties: {
          term: { type: "string", minLength: 1 },
          normalizedForm: { type: "string", minLength: 1 },
          language: { type: "string", maxLength: 10 },
          category: { type: "string", minLength: 1 },
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
    if (!requireAdmin(request, reply)) return;
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
    if (!requireAdmin(request, reply)) return;
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

  // POST /api/v1/slang/batch — Batch approve/reject/delete
  app.post("/api/v1/slang/batch", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["ids", "action"],
        properties: {
          ids: { type: "array", items: { type: "string", format: "uuid" }, minItems: 1, maxItems: 100 },
          action: { type: "string", enum: ["approve", "reject", "delete"] },
        },
      },
    },
  }, async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const { ids, action } = request.body as { ids: string[]; action: string };
    const { userId } = request.authUser!;
    let affected = 0;

    if (action === "approve") {
      const result = await query(
        `UPDATE slang_dictionary SET submission_status = 'APPROVED', reviewed_by = $1, reviewed_at = NOW(), updated_at = NOW()
         WHERE slang_id = ANY($2::uuid[]) AND submission_status = 'PENDING'`,
        [userId, ids],
      );
      affected = result.rowCount ?? 0;
    } else if (action === "reject") {
      const result = await query(
        `UPDATE slang_dictionary SET submission_status = 'REJECTED', reviewed_by = $1, reviewed_at = NOW(), updated_at = NOW()
         WHERE slang_id = ANY($2::uuid[]) AND submission_status = 'PENDING'`,
        [userId, ids],
      );
      affected = result.rowCount ?? 0;
    } else if (action === "delete") {
      const result = await query(
        `UPDATE slang_dictionary SET is_active = FALSE, updated_at = NOW()
         WHERE slang_id = ANY($1::uuid[]) AND is_active = TRUE`,
        [ids],
      );
      affected = result.rowCount ?? 0;
    }

    return { affected, total: ids.length };
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
    if (!requireAdmin(request, reply)) return;
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

  // GET /api/v1/emoji-codes — List emoji drug code reference entries
  app.get("/api/v1/emoji-codes", async () => {
    const result = await query(
      `SELECT emoji_code_id AS emoji_id, emoji, drug_category, risk_weight, signal_type, description,
              COALESCE(is_active, TRUE) AS is_active, created_at
       FROM emoji_drug_code WHERE COALESCE(is_active, TRUE) = TRUE
       ORDER BY drug_category, emoji`,
    );
    return { entries: result.rows, total: result.rows.length };
  });

  // POST /api/v1/emoji-codes — Create emoji code entry
  app.post("/api/v1/emoji-codes", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["emoji", "drugCategory"],
        properties: {
          emoji: { type: "string", minLength: 1 },
          drugCategory: { type: "string", minLength: 1 },
          riskWeight: { type: "number", minimum: 0, maximum: 10 },
          signalType: { type: "string", enum: ["SUBSTANCE", "TRANSACTION", "QUALITY"] },
          description: { type: "string" },
        },
      },
    },
  }, async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    try {
      const body = request.body as Record<string, unknown>;
      const result = await query(
        `INSERT INTO emoji_drug_code (emoji, drug_category, risk_weight, signal_type, description)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (emoji) DO UPDATE SET drug_category = EXCLUDED.drug_category, risk_weight = EXCLUDED.risk_weight, signal_type = EXCLUDED.signal_type, description = EXCLUDED.description, updated_at = NOW()
         RETURNING emoji_code_id AS emoji_id, emoji, drug_category, risk_weight, signal_type, description, is_active, created_at`,
        [body.emoji, body.drugCategory, body.riskWeight || 1.0, body.signalType || "SUBSTANCE", body.description || null],
      );
      reply.code(201);
      return { entry: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to create emoji code");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // PATCH /api/v1/emoji-codes/:id — Update emoji code entry
  app.patch("/api/v1/emoji-codes/:id", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: {
        type: "object",
        additionalProperties: false,
        properties: {
          emoji: { type: "string" },
          drugCategory: { type: "string" },
          riskWeight: { type: "number", minimum: 0, maximum: 10 },
          signalType: { type: "string", enum: ["SUBSTANCE", "TRANSACTION", "QUALITY"] },
          description: { type: "string" },
        },
      },
    },
  }, async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;
    const result = await query(
      `UPDATE emoji_drug_code
       SET emoji = COALESCE($2, emoji),
           drug_category = COALESCE($3, drug_category),
           risk_weight = COALESCE($4, risk_weight),
           signal_type = COALESCE($5, signal_type),
           description = COALESCE($6, description),
           updated_at = NOW()
       WHERE emoji_code_id = $1 AND COALESCE(is_active, TRUE) = TRUE
       RETURNING emoji_code_id AS emoji_id, emoji, drug_category, risk_weight, signal_type, description, is_active, created_at`,
      [id, body.emoji ?? null, body.drugCategory ?? null, body.riskWeight ?? null, body.signalType ?? null, body.description ?? null],
    );
    if (result.rows.length === 0) return send404(reply, "NOT_FOUND", "Emoji code not found");
    return { entry: result.rows[0] };
  });

  // DELETE /api/v1/emoji-codes/:id — Soft delete emoji code
  app.delete("/api/v1/emoji-codes/:id", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const { id } = request.params as { id: string };
    const result = await query(
      `UPDATE emoji_drug_code SET is_active = FALSE, updated_at = NOW() WHERE emoji_code_id = $1
       RETURNING emoji_code_id AS emoji_id`,
      [id],
    );
    if (result.rows.length === 0) return send404(reply, "EMOJI_NOT_FOUND", "Emoji code not found");
    return { success: true };
  });

  // DELETE /api/v1/slang/:id — Soft delete
  app.delete("/api/v1/slang/:id", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
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
