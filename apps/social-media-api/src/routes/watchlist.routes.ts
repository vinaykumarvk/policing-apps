import { FastifyInstance } from "fastify";
import { query } from "../db";
import { send400, send404 } from "../errors";

export async function registerWatchlistRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/watchlists", async () => {
    const result = await query(
      `SELECT watchlist_id, name, description, keywords, platforms, is_active,
              created_by, created_at
       FROM watchlist ORDER BY created_at DESC`,
    );
    return { watchlists: result.rows, total: result.rows.length };
  });

  app.post("/api/v1/watchlists", {
    schema: { body: { type: "object", additionalProperties: false, required: ["name"], properties: { name: { type: "string" }, description: { type: "string" }, keywords: { type: "array", items: { type: "string" } } } } },
  }, async (request, reply) => {
    const { name, description, keywords } = request.body as { name: string; description?: string; keywords?: string[] };
    const { userId } = request.authUser!;
    const result = await query(
      `INSERT INTO watchlist (name, description, keywords, created_by) VALUES ($1, $2, $3, $4)
       RETURNING watchlist_id, name, description, keywords, is_active, created_by, created_at`,
      [name, description || null, JSON.stringify(keywords || []), userId],
    );
    reply.code(201);
    return { watchlist: result.rows[0] };
  });

  app.put("/api/v1/watchlists/:id", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: { type: "object", additionalProperties: false, properties: { name: { type: "string" }, description: { type: "string" }, keywords: { type: "array", items: { type: "string" } }, isActive: { type: "boolean" } } },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { name, description, keywords, isActive } = request.body as { name?: string; description?: string; keywords?: string[]; isActive?: boolean };

    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (name !== undefined) { sets.push(`name = $${idx++}`); params.push(name); }
    if (description !== undefined) { sets.push(`description = $${idx++}`); params.push(description); }
    if (keywords !== undefined) { sets.push(`keywords = $${idx++}`); params.push(JSON.stringify(keywords)); }
    if (isActive !== undefined) { sets.push(`is_active = $${idx++}`); params.push(isActive); }

    if (sets.length === 0) {
      return send400(reply, "NO_FIELDS", "No fields to update");
    }

    sets.push(`updated_at = NOW()`);
    params.push(id);

    const result = await query(
      `UPDATE watchlist SET ${sets.join(", ")} WHERE watchlist_id = $${idx}
       RETURNING watchlist_id, name, description, keywords, is_active, updated_at`,
      params,
    );
    if (result.rows.length === 0) {
      return send404(reply, "WATCHLIST_NOT_FOUND", "Watchlist not found");
    }
    return { watchlist: result.rows[0] };
  });
}
