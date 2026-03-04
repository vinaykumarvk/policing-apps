import { FastifyInstance } from "fastify";
import jwt from "jsonwebtoken";
import { authenticate } from "../auth";
import { generateToken, setAuthCookie, clearAuthCookie, revokeToken } from "../middleware/auth";
import { sendError } from "../errors";

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/v1/auth/login", {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: "1 minute",
      },
    },
    schema: { body: { type: "object", additionalProperties: false, properties: { username: { type: "string" }, password: { type: "string" } }, required: ["username", "password"] } },
  }, async (request, reply) => {
    const { username, password } = request.body as { username: string; password: string };
    const result = await authenticate(username, password);
    if (result.mfaRequired) {
      const { generateToken: genToken } = await import("../middleware/auth");
      const mfaChallengeToken = genToken({ user_id: result.mfaUserId!, user_type: "MFA_CHALLENGE", roles: [], unit_id: null });
      return { mfaRequired: true, mfaChallengeToken };
    }
    if (!result.user) {
      return sendError(reply, 401, "INVALID_CREDENTIALS", "Invalid username or password");
    }
    const token = generateToken({ user_id: result.user.user_id, user_type: result.user.user_type, roles: result.user.roles, unit_id: result.user.unit_id });
    setAuthCookie(reply, token);
    return { user: result.user, token };
  });

  app.post("/api/v1/auth/logout", {
    schema: { body: { type: "object", additionalProperties: false, properties: {} } },
  }, async (request, reply) => {
    const authUser = request.authUser;
    const authToken = request.authToken;
    if (authUser && authToken) {
      const decoded = jwt.decode(authToken) as any;
      if (decoded?.exp) {
        await revokeToken(authUser.jti, authUser.userId, new Date(decoded.exp * 1000));
      }
    }
    clearAuthCookie(reply);
    return { success: true };
  });

  app.get("/api/v1/auth/me", async (request, reply) => {
    if (!request.authUser) { reply.code(401); return { error: "UNAUTHORIZED", statusCode: 401, message: "Not authenticated" }; }
    return { user: request.authUser };
  });
}
