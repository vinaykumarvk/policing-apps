import { FastifyInstance } from "fastify";
import { query } from "../db";
import { createUser } from "../auth";
import { send400 } from "../errors";

export async function registerAdminRoutes(app: FastifyInstance): Promise<void> {
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
    schema: { body: { type: "object", additionalProperties: false, required: ["username", "password", "fullName"], properties: { username: { type: "string" }, password: { type: "string" }, fullName: { type: "string" } } } },
  }, async (request, reply) => {
    const { username, password, fullName } = request.body as { username: string; password: string; fullName: string };
    try {
      const user = await createUser({ username, password, fullName });
      reply.code(201);
      return { user };
    } catch (err: any) {
      if (err.code === "23505") {
        return send400(reply, "USERNAME_EXISTS", "Username already taken");
      }
      throw err;
    }
  });
}
