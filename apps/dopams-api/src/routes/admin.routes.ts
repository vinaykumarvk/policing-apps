import { FastifyInstance } from "fastify";
import { query } from "../db";
import { createUser } from "../auth";
import { sendError, send400, send404 } from "../errors";

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
    schema: { body: { type: "object", additionalProperties: false, required: ["username", "password", "fullName"], properties: { username: { type: "string" }, password: { type: "string" }, fullName: { type: "string" }, userType: { type: "string" } } } },
  }, async (request, reply) => {
    const { username, password, fullName, userType } = request.body as { username: string; password: string; fullName: string; userType?: string };
    try {
      const user = await createUser({ username, password, fullName, userType });
      reply.code(201);
      return { user };
    } catch (err: any) {
      if (err.code === "23505") {
        return send400(reply, "USERNAME_EXISTS", "Username already taken");
      }
      throw err;
    }
  });

  app.put("/api/v1/users/:id/role", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: { type: "object", additionalProperties: false, required: ["roleId"], properties: { roleId: { type: "string" }, action: { type: "string", enum: ["assign", "revoke"] } } },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { roleId, action } = request.body as { roleId: string; action?: "assign" | "revoke" };

    const userCheck = await query(`SELECT 1 FROM user_account WHERE user_id = $1`, [id]);
    if (userCheck.rows.length === 0) {
      return send404(reply, "USER_NOT_FOUND", "User not found");
    }

    const roleCheck = await query(`SELECT role_id FROM role WHERE role_id = $1`, [roleId]);
    if (roleCheck.rows.length === 0) {
      return send404(reply, "ROLE_NOT_FOUND", "Role not found");
    }

    if (action === "revoke") {
      await query(`DELETE FROM user_role WHERE user_id = $1 AND role_id = $2`, [id, roleId]);
    } else {
      await query(
        `INSERT INTO user_role (user_id, role_id) VALUES ($1, $2) ON CONFLICT (user_id, role_id) DO NOTHING`,
        [id, roleId],
      );
    }

    return { success: true };
  });
}
