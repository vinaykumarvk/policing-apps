import { FastifyInstance } from "fastify";
import { query } from "../db";
import { send400, send404, sendError } from "../errors";

export async function registerMonitoringRoutes(app: FastifyInstance): Promise<void> {
  // ─── PROFILES (Tier-1) ────────────────────────────────────────────

  // GET /api/v1/monitoring/profiles — List with pagination, filters
  app.get("/api/v1/monitoring/profiles", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          platform: { type: "string", maxLength: 64 },
          entryType: { type: "string", enum: ["PROFILE", "GROUP", "PAGE"] },
          source: { type: "string", enum: ["MANUAL", "NIDAAN", "TEF", "PRIVATE", "BULK_CSV"] },
          search: { type: "string", maxLength: 200 },
          limit: { type: "integer", minimum: 1, maximum: 200, default: 20 },
          offset: { type: "integer", minimum: 0, default: 0 },
        },
      },
    },
  }, async (request) => {
    const qs = request.query as Record<string, string | undefined>;
    const limit = Math.min(parseInt(qs.limit || "20", 10) || 20, 200);
    const offset = Math.max(parseInt(qs.offset || "0", 10) || 0, 0);
    const searchTerm = qs.search ? `%${qs.search}%` : null;

    const result = await query(
      `SELECT profile_id, platform, entry_type, handle, url, is_active, priority,
              source, source_ref, suspect_name, notes,
              last_scraped_at, created_by, created_at, updated_at,
              COUNT(*) OVER() AS total_count
       FROM monitoring_profile
       WHERE is_active = TRUE
         AND ($1::text IS NULL OR platform = $1)
         AND ($2::text IS NULL OR entry_type = $2)
         AND ($3::text IS NULL OR handle ILIKE $3 OR url ILIKE $3)
         AND ($6::text IS NULL OR source = $6)
       ORDER BY CASE priority WHEN 'HIGH' THEN 1 WHEN 'NORMAL' THEN 2 ELSE 3 END, created_at DESC
       LIMIT $4 OFFSET $5`,
      [qs.platform || null, qs.entryType || null, searchTerm, limit, offset, qs.source || null],
    );
    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
    return { profiles: result.rows.map(({ total_count, ...r }: any) => r), total };
  });

  // POST /api/v1/monitoring/profiles — Create
  app.post("/api/v1/monitoring/profiles", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["platform"],
        properties: {
          platform: { type: "string", enum: ["facebook", "instagram", "twitter", "x"] },
          entryType: { type: "string", enum: ["PROFILE", "GROUP", "PAGE"], default: "PROFILE" },
          handle: { type: "string", maxLength: 256 },
          url: { type: "string", maxLength: 2048 },
          priority: { type: "string", enum: ["HIGH", "NORMAL", "LOW"], default: "NORMAL" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const body = request.body as Record<string, unknown>;
      if (!body.handle && !body.url) {
        return send400(reply, "VALIDATION_ERROR", "At least one of handle or url is required");
      }
      const { userId } = request.authUser!;
      const result = await query(
        `INSERT INTO monitoring_profile (platform, entry_type, handle, url, priority, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING profile_id, platform, entry_type, handle, url, is_active, priority, created_at`,
        [body.platform, body.entryType || "PROFILE", body.handle || null, body.url || null, body.priority || "NORMAL", userId],
      );
      reply.code(201);
      return { profile: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to create monitoring profile");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // PATCH /api/v1/monitoring/profiles/:id — Update
  app.patch("/api/v1/monitoring/profiles/:id", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: {
        type: "object",
        additionalProperties: false,
        properties: {
          platform: { type: "string", enum: ["facebook", "instagram", "twitter", "x"] },
          entryType: { type: "string", enum: ["PROFILE", "GROUP", "PAGE"] },
          handle: { type: "string", maxLength: 256 },
          url: { type: "string", maxLength: 2048 },
          priority: { type: "string", enum: ["HIGH", "NORMAL", "LOW"] },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;
    const result = await query(
      `UPDATE monitoring_profile
       SET platform   = COALESCE($2, platform),
           entry_type = COALESCE($3, entry_type),
           handle     = COALESCE($4, handle),
           url        = COALESCE($5, url),
           priority   = COALESCE($6, priority),
           updated_at = NOW()
       WHERE profile_id = $1 AND is_active = TRUE
       RETURNING profile_id, platform, entry_type, handle, url, is_active, priority, last_scraped_at, created_at, updated_at`,
      [id, body.platform ?? null, body.entryType ?? null, body.handle ?? null, body.url ?? null, body.priority ?? null],
    );
    if (result.rows.length === 0) return send404(reply, "NOT_FOUND", "Profile not found");
    return { profile: result.rows[0] };
  });

  // DELETE /api/v1/monitoring/profiles/:id — Soft delete
  app.delete("/api/v1/monitoring/profiles/:id", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await query(
      `UPDATE monitoring_profile SET is_active = FALSE, updated_at = NOW() WHERE profile_id = $1 AND is_active = TRUE
       RETURNING profile_id`,
      [id],
    );
    if (result.rows.length === 0) return send404(reply, "NOT_FOUND", "Profile not found");
    return { success: true };
  });

  // ─── LOCATIONS (Tier-2) ───────────────────────────────────────────

  // GET /api/v1/monitoring/locations — List with pagination
  app.get("/api/v1/monitoring/locations", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          search: { type: "string", maxLength: 200 },
          limit: { type: "integer", minimum: 1, maximum: 200, default: 20 },
          offset: { type: "integer", minimum: 0, default: 0 },
        },
      },
    },
  }, async (request) => {
    const qs = request.query as Record<string, string | undefined>;
    const limit = Math.min(parseInt(qs.limit || "20", 10) || 20, 200);
    const offset = Math.max(parseInt(qs.offset || "0", 10) || 0, 0);
    const searchTerm = qs.search ? `%${qs.search}%` : null;

    const result = await query(
      `SELECT location_id, district_name, city_names, area_names, alt_spellings,
              is_active, notes, created_by, created_at, updated_at,
              COUNT(*) OVER() AS total_count
       FROM jurisdiction_location
       WHERE is_active = TRUE
         AND ($1::text IS NULL OR district_name ILIKE $1)
       ORDER BY district_name ASC
       LIMIT $2 OFFSET $3`,
      [searchTerm, limit, offset],
    );
    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
    return { locations: result.rows.map(({ total_count, ...r }: any) => r), total };
  });

  // POST /api/v1/monitoring/locations — Create
  app.post("/api/v1/monitoring/locations", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["districtName"],
        properties: {
          districtName: { type: "string", maxLength: 256 },
          cityNames: { type: "array", items: { type: "string" }, default: [] },
          areaNames: { type: "array", items: { type: "string" }, default: [] },
          altSpellings: { type: "array", items: { type: "string" }, default: [] },
          notes: { type: "string" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const { userId } = request.authUser!;
      const result = await query(
        `INSERT INTO jurisdiction_location (district_name, city_names, area_names, alt_spellings, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING location_id, district_name, city_names, area_names, alt_spellings, is_active, notes, created_at`,
        [body.districtName, JSON.stringify(body.cityNames || []), JSON.stringify(body.areaNames || []), JSON.stringify(body.altSpellings || []), body.notes || null, userId],
      );
      reply.code(201);
      return { location: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to create jurisdiction location");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // PATCH /api/v1/monitoring/locations/:id — Update
  app.patch("/api/v1/monitoring/locations/:id", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: {
        type: "object",
        additionalProperties: false,
        properties: {
          districtName: { type: "string", maxLength: 256 },
          cityNames: { type: "array", items: { type: "string" } },
          areaNames: { type: "array", items: { type: "string" } },
          altSpellings: { type: "array", items: { type: "string" } },
          notes: { type: "string" },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;
    const result = await query(
      `UPDATE jurisdiction_location
       SET district_name = COALESCE($2, district_name),
           city_names    = COALESCE($3, city_names),
           area_names    = COALESCE($4, area_names),
           alt_spellings = COALESCE($5, alt_spellings),
           notes         = COALESCE($6, notes),
           updated_at    = NOW()
       WHERE location_id = $1 AND is_active = TRUE
       RETURNING location_id, district_name, city_names, area_names, alt_spellings, is_active, notes, created_at, updated_at`,
      [
        id,
        body.districtName ?? null,
        body.cityNames ? JSON.stringify(body.cityNames) : null,
        body.areaNames ? JSON.stringify(body.areaNames) : null,
        body.altSpellings ? JSON.stringify(body.altSpellings) : null,
        body.notes ?? null,
      ],
    );
    if (result.rows.length === 0) return send404(reply, "NOT_FOUND", "Location not found");
    return { location: result.rows[0] };
  });

  // DELETE /api/v1/monitoring/locations/:id — Soft delete
  app.delete("/api/v1/monitoring/locations/:id", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await query(
      `UPDATE jurisdiction_location SET is_active = FALSE, updated_at = NOW() WHERE location_id = $1 AND is_active = TRUE
       RETURNING location_id`,
      [id],
    );
    if (result.rows.length === 0) return send404(reply, "NOT_FOUND", "Location not found");
    return { success: true };
  });
}
