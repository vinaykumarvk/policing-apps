import { FastifyInstance } from "fastify";
import { query } from "../db";
import { send400, send404, sendError } from "../errors";
import { getUnitTree, resolveUnitHierarchy, refreshCache } from "../services/jurisdiction";

export async function registerJurisdictionRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/v1/units — List or tree
  app.get("/api/v1/units", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          root_id: { type: "string", format: "uuid" },
          unit_type: { type: "string", maxLength: 50 },
        },
      },
    },
  }, async (request) => {
    const { root_id, unit_type } = request.query as Record<string, string | undefined>;
    if (root_id) {
      const tree = await getUnitTree(root_id);
      return { units: tree };
    }
    const result = await query(
      `SELECT unit_id, unit_name, parent_id, unit_type, level, path, is_active
       FROM organization_unit
       WHERE ($1::text IS NULL OR unit_type = $1)
       ORDER BY COALESCE(path, unit_name)`,
      [unit_type || null],
    );
    return { units: result.rows };
  });

  // POST /api/v1/units — Create unit
  app.post("/api/v1/units", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["unitName", "unitType"],
        properties: {
          unitName: { type: "string" },
          unitType: { type: "string", enum: ["STATE", "ZONE", "DISTRICT", "POLICE_STATION", "UNIT"] },
          parentId: { type: "string", format: "uuid" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { unitName, unitType, parentId } = request.body as {
        unitName: string; unitType: string; parentId?: string;
      };

      let level = 0;
      let path = `/${unitName.toLowerCase().replace(/\s+/g, "-")}`;

      if (parentId) {
        const parent = await query(`SELECT level, path FROM organization_unit WHERE unit_id = $1`, [parentId]);
        if (parent.rows.length === 0) return send404(reply, "PARENT_NOT_FOUND", "Parent unit not found");
        level = (parent.rows[0].level || 0) + 1;
        path = `${parent.rows[0].path || ""}/${unitName.toLowerCase().replace(/\s+/g, "-")}`;
      }

      const result = await query(
        `INSERT INTO organization_unit (unit_name, unit_type, parent_id, level, path)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING unit_id, unit_name, unit_type, parent_id, level, path, created_at`,
        [unitName, unitType, parentId || null, level, path],
      );

      // Refresh cache after modification
      await refreshCache();

      reply.code(201);
      return { unit: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to create unit");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // GET /api/v1/units/:id/hierarchy — Get hierarchy for a unit
  app.get("/api/v1/units/:id/hierarchy", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const hierarchy = await resolveUnitHierarchy(id);
    return { unitId: id, ...hierarchy };
  });

  // POST /api/v1/units/refresh-cache — Refresh jurisdiction cache
  app.post("/api/v1/units/refresh-cache", async () => {
    await refreshCache();
    return { success: true, refreshedAt: new Date().toISOString() };
  });
}
