import { FastifyInstance } from "fastify";
import { authenticate } from "../auth";
import { generateToken, setAuthCookie, clearAuthCookie } from "../middleware/auth";
import { sendError } from "../errors";

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/v1/auth/login", {
    schema: { body: { type: "object", additionalProperties: false, properties: { username: { type: "string" }, password: { type: "string" } }, required: ["username", "password"] } },
  }, async (request, reply) => {
    const { username, password } = request.body as { username: string; password: string };
    const user = await authenticate(username, password);
    if (!user) {
      return sendError(reply, 401, "INVALID_CREDENTIALS", "Invalid username or password");
    }
    const token = generateToken({ user_id: user.user_id, user_type: user.user_type, roles: user.roles });
    setAuthCookie(reply, token);
    return { user, token };
  });

  app.post("/api/v1/auth/logout", {
    schema: { body: { type: "object", additionalProperties: false, properties: {} } },
  }, async (_request, reply) => {
    clearAuthCookie(reply);
    return { success: true };
  });

  app.get("/api/v1/auth/me", async (request, reply) => {
    if (!request.authUser) { reply.code(401); return { error: "UNAUTHORIZED", statusCode: 401, message: "Not authenticated" }; }
    return { user: request.authUser };
  });
}
