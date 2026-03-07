import { FastifyInstance } from "fastify";
import { query } from "../db";
import { send400, send404, sendError } from "../errors";

export async function registerDictionaryRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/v1/dictionaries — List keyword dictionaries
  app.get("/api/v1/dictionaries", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          category: { type: "string", maxLength: 100 },
          is_active: { type: "string", maxLength: 10 },
          limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
          offset: { type: "integer", minimum: 0, default: 0 },
        },
      },
    },
  }, async (request) => {
    const { category, is_active, limit: rawLimit, offset: rawOffset } = request.query as Record<string, string | undefined>;
    const limit = Math.min(parseInt(rawLimit || "50", 10) || 50, 200);
    const offset = Math.max(parseInt(rawOffset || "0", 10) || 0, 0);
    const isActiveBool = is_active === undefined ? null : is_active === "true";

    const result = await query(
      `SELECT dictionary_id, dictionary_name, category, keywords, regex_patterns,
              version, is_active, created_at,
              COUNT(*) OVER() AS total_count
       FROM keyword_dictionary
       WHERE ($1::text IS NULL OR category = $1)
         AND ($2::boolean IS NULL OR is_active = $2)
       ORDER BY category, dictionary_name
       LIMIT $3 OFFSET $4`,
      [category || null, isActiveBool, limit, offset],
    );
    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
    return { dictionaries: result.rows.map(({ total_count, ...r }) => r), total };
  });

  // GET /api/v1/dictionaries/:id
  app.get("/api/v1/dictionaries/:id", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await query(
      `SELECT dictionary_id, dictionary_name, category, keywords, regex_patterns,
              version, description, is_active, created_by, created_at, updated_at
       FROM keyword_dictionary WHERE dictionary_id = $1`,
      [id],
    );
    if (result.rows.length === 0) return send404(reply, "DICTIONARY_NOT_FOUND", "Dictionary not found");
    return { dictionary: result.rows[0] };
  });

  // POST /api/v1/dictionaries — Create
  app.post("/api/v1/dictionaries", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["dictionaryName", "category", "keywords"],
        properties: {
          dictionaryName: { type: "string" },
          category: { type: "string" },
          keywords: { type: "array", items: { type: "string" } },
          regexPatterns: { type: "array", items: { type: "string" } },
          description: { type: "string" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const { userId } = request.authUser!;
      const result = await query(
        `INSERT INTO keyword_dictionary (dictionary_name, category, keywords, regex_patterns, description, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING dictionary_id, dictionary_name, category, version, created_at`,
        [body.dictionaryName, body.category, JSON.stringify(body.keywords),
         JSON.stringify(body.regexPatterns || []), body.description || null, userId],
      );
      reply.code(201);
      return { dictionary: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to create dictionary");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // PUT /api/v1/dictionaries/:id — Update (creates new version)
  app.put("/api/v1/dictionaries/:id", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: {
        type: "object",
        additionalProperties: false,
        properties: {
          dictionaryName: { type: "string" },
          keywords: { type: "array", items: { type: "string" } },
          regexPatterns: { type: "array", items: { type: "string" } },
          description: { type: "string" },
          isActive: { type: "boolean" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;
      const sets: string[] = [];
      const params: unknown[] = [];
      let idx = 1;

      if (body.dictionaryName !== undefined) { sets.push(`dictionary_name = $${idx++}`); params.push(body.dictionaryName); }
      if (body.keywords !== undefined) { sets.push(`keywords = $${idx++}`); params.push(JSON.stringify(body.keywords)); }
      if (body.regexPatterns !== undefined) { sets.push(`regex_patterns = $${idx++}`); params.push(JSON.stringify(body.regexPatterns)); }
      if (body.description !== undefined) { sets.push(`description = $${idx++}`); params.push(body.description); }
      if (body.isActive !== undefined) { sets.push(`is_active = $${idx++}`); params.push(body.isActive); }

      if (sets.length === 0) return send400(reply, "NO_FIELDS", "No fields to update");

      // Increment version on content changes
      if (body.keywords !== undefined || body.regexPatterns !== undefined) {
        sets.push(`version = version + 1`);
      }
      sets.push(`updated_at = NOW()`);
      params.push(id);

      const result = await query(
        `UPDATE keyword_dictionary SET ${sets.join(", ")} WHERE dictionary_id = $${idx}
         RETURNING dictionary_id, dictionary_name, category, version, updated_at`,
        params,
      );
      if (result.rows.length === 0) return send404(reply, "DICTIONARY_NOT_FOUND", "Dictionary not found");
      return { dictionary: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to update dictionary");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });
}
