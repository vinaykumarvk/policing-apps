import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { query } from "../db";
import { createUser } from "../auth";
import { sendError, send400, send403, send404 } from "../errors";

function validatePasswordComplexity(pw: string): string | null {
  if (pw.length < 12) return "Password must be at least 12 characters";
  if (!/[A-Z]/.test(pw)) return "Password must contain an uppercase letter";
  if (!/[a-z]/.test(pw)) return "Password must contain a lowercase letter";
  if (!/[0-9]/.test(pw)) return "Password must contain a digit";
  if (!/[^A-Za-z0-9]/.test(pw)) return "Password must contain a special character";
  return null;
}

export async function registerAdminRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
    const roles = request.authUser?.roles ?? [];
    if (!roles.includes("ADMINISTRATOR") && !roles.includes("PLATFORM_ADMINISTRATOR")) {
      send403(reply, "FORBIDDEN", "Administrator access required");
      return;
    }
  });

  app.get("/api/v1/users", async () => {
    const result = await query(
      `SELECT u.user_id, u.username, u.full_name, u.user_type, u.is_active, u.created_at,
              COALESCE(array_agg(r.role_key) FILTER (WHERE r.role_key IS NOT NULL), '{}') AS roles
       FROM user_account u
       LEFT JOIN user_role ur ON ur.user_id = u.user_id
       LEFT JOIN role r ON r.role_id = ur.role_id
       GROUP BY u.user_id
       ORDER BY u.created_at DESC`,
    );
    return { users: result.rows, total: result.rows.length };
  });

  app.post("/api/v1/users", {
    schema: { body: { type: "object", additionalProperties: false, required: ["username", "password", "fullName"], properties: { username: { type: "string", minLength: 3, maxLength: 100 }, password: { type: "string", minLength: 12, maxLength: 128 }, fullName: { type: "string", minLength: 1, maxLength: 200 } } } },
  }, async (request, reply) => {
    const { username, password, fullName } = request.body as { username: string; password: string; fullName: string };
    const pwError = validatePasswordComplexity(password);
    if (pwError) return send400(reply, "WEAK_PASSWORD", pwError);
    try {
      const user = await createUser({ username, password, fullName });
      reply.code(201);
      return { user };
    } catch (err: unknown) {
      const pgCode = err instanceof Error && "code" in err ? (err as any).code : undefined;
      if (pgCode === "23505") {
        return send400(reply, "USERNAME_EXISTS", "Username already taken");
      }
      request.log.error(err, "User creation failed");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  app.get("/api/v1/taxonomy", async () => {
    const result = await query(
      `SELECT category_id, name, description, is_active, created_at FROM taxonomy_category ORDER BY name ASC`,
    );
    return { categories: result.rows, total: result.rows.length };
  });

  app.put("/api/v1/taxonomy/:id", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: { type: "object", additionalProperties: false, properties: { name: { type: "string" }, description: { type: "string" }, isActive: { type: "boolean" } } },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { name, description, isActive } = request.body as { name?: string; description?: string; isActive?: boolean };

    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (name !== undefined) { sets.push(`name = $${idx++}`); params.push(name); }
    if (description !== undefined) { sets.push(`description = $${idx++}`); params.push(description); }
    if (isActive !== undefined) { sets.push(`is_active = $${idx++}`); params.push(isActive); }

    if (sets.length === 0) {
      return send400(reply, "NO_FIELDS", "No fields to update");
    }

    sets.push(`updated_at = NOW()`);
    params.push(id);

    const result = await query(
      `UPDATE taxonomy_category SET ${sets.join(", ")} WHERE category_id = $${idx} RETURNING category_id, name, description, is_active`,
      params,
    );
    if (result.rows.length === 0) {
      return send404(reply, "CATEGORY_NOT_FOUND", "Taxonomy category not found");
    }
    return { category: result.rows[0] };
  });
}
