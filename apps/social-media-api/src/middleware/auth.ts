import { createAuthMiddleware } from "@puda/api-core";
import { query } from "../db";

export type { AuthPayload } from "@puda/api-core";

const auth = createAuthMiddleware({
  cookieName: "sm_auth",
  defaultDevSecret: "sm-dev-secret-DO-NOT-USE-IN-PRODUCTION",
  queryFn: query,
});

export const verifyToken = auth.verifyToken;
export const generateToken = auth.generateToken;
export const setAuthCookie = auth.setAuthCookie;
export const clearAuthCookie = auth.clearAuthCookie;
export const checkTokenRevocation = auth.checkTokenRevocation;
export const revokeToken = auth.revokeToken;
export const revokeAllUserTokens = auth.revokeAllUserTokens;

// FR-02: Permission level timeout mapping (PL0-PL4)
const PERMISSION_LEVEL_TIMEOUT_MINUTES: Record<number, number> = {
  0: 5,    // PL0 — highest privilege, shortest timeout
  1: 15,   // PL1
  2: 30,   // PL2
  3: 60,   // PL3
  4: 120,  // PL4 — lowest privilege, longest timeout
};

/**
 * FR-02: Get the session timeout in minutes for a given permission level.
 */
export function getTimeoutForPermissionLevel(level: number): number {
  return PERMISSION_LEVEL_TIMEOUT_MINUTES[level] ?? 30;
}

/**
 * FR-02: Check if the user has a role with a permission level at or below the required level.
 * Lower permission_level = higher privilege (PL0 is admin).
 * Returns true if user has sufficient permission.
 */
export async function checkPermissionLevel(userId: string, requiredLevel: number): Promise<boolean> {
  const result = await query(
    `SELECT MIN(r.permission_level) AS min_level
     FROM user_role ur
     JOIN role r ON r.role_id = ur.role_id
     WHERE ur.user_id = $1`,
    [userId],
  );
  if (result.rows.length === 0 || result.rows[0].min_level === null) return false;
  return result.rows[0].min_level <= requiredLevel;
}

/**
 * FR-02: Get the session timeout for a user based on their highest-privilege role.
 */
export async function getUserSessionTimeout(userId: string): Promise<number> {
  const result = await query(
    `SELECT MIN(r.permission_level) AS min_level, MIN(r.session_timeout_minutes) AS min_timeout
     FROM user_role ur
     JOIN role r ON r.role_id = ur.role_id
     WHERE ur.user_id = $1`,
    [userId],
  );
  if (result.rows.length === 0 || result.rows[0].min_level === null) return 30;
  return result.rows[0].min_timeout || getTimeoutForPermissionLevel(result.rows[0].min_level);
}

/**
 * FR-02: Fastify preHandler to enforce a minimum permission level on a route.
 * Usage: { preHandler: requirePermissionLevel(2) }
 */
export function requirePermissionLevel(requiredLevel: number) {
  return async (request: import("fastify").FastifyRequest, reply: import("fastify").FastifyReply) => {
    if (!request.authUser?.userId) {
      return reply.code(401).send({ error: "UNAUTHORIZED", message: "Authentication required", statusCode: 401 });
    }
    const allowed = await checkPermissionLevel(request.authUser.userId, requiredLevel);
    if (!allowed) {
      return reply.code(403).send({
        error: "INSUFFICIENT_PERMISSION_LEVEL",
        message: `This action requires permission level ${requiredLevel} or higher`,
        statusCode: 403,
      });
    }
  };
}

export function registerAuthMiddleware(app: import("fastify").FastifyInstance) {
  auth.register(app);

  // FR-17: MFA enforcement check — skip for auth routes and health endpoints
  const MFA_EXEMPT_PATHS = ["/api/v1/auth/", "/health", "/ready", "/api/v1/auth/mfa"];
  const MFA_REVALIDATION_HOURS = parseInt(process.env.MFA_REVALIDATION_HOURS || "8", 10);

  app.addHook("onRequest", async (request, reply) => {
    // Skip MFA check for exempt paths
    if (MFA_EXEMPT_PATHS.some((p) => request.url.startsWith(p))) return;
    if (!request.authUser?.userId) return;

    try {
      const userResult = await query(
        `SELECT mfa_enforced, mfa_last_verified_at FROM user_account WHERE user_id = $1`,
        [request.authUser.userId],
      );
      if (userResult.rows.length === 0) return;

      const { mfa_enforced, mfa_last_verified_at } = userResult.rows[0];
      if (!mfa_enforced) return;

      // Check if MFA was verified within the revalidation window
      if (mfa_last_verified_at) {
        const verifiedAt = new Date(mfa_last_verified_at);
        const hoursSinceVerification = (Date.now() - verifiedAt.getTime()) / (1000 * 60 * 60);
        if (hoursSinceVerification < MFA_REVALIDATION_HOURS) return;
      }

      reply.code(403).send({
        error: "MFA_REQUIRED",
        message: "Multi-factor authentication verification required",
        statusCode: 403,
      });
    } catch {
      // MFA check failure should not block requests — log and continue
    }
  });
}
