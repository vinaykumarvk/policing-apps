import { randomUUID } from "node:crypto";
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import jwt, { JwtPayload, SignOptions } from "jsonwebtoken";
import { query } from "../db";

if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  throw new Error("FATAL: JWT_SECRET must be set in production");
}
const JWT_SECRET = process.env.JWT_SECRET || "forensic-dev-secret-DO-NOT-USE-IN-PRODUCTION";
const COOKIE_NAME = "forensic_auth";
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

const PUBLIC_ROUTES = ["/health", "/ready", "/api/v1/auth/login", "/api/v1/auth/logout"];

export interface AuthPayload {
  userId: string;
  userType: string;
  roles: string[];
  jti: string;
  unitId: string | null;
}

declare module "fastify" {
  interface FastifyRequest {
    authUser?: AuthPayload;
    authToken?: string;
  }
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] }) as JwtPayload;
    if (!payload.userId || !payload.userType) return null;
    return {
      userId: payload.userId as string,
      userType: payload.userType as string,
      roles: (payload.roles as string[]) || [],
      jti: (payload.jti as string) || "",
      unitId: (payload.unitId as string) || null,
    };
  } catch {
    return null;
  }
}

export function generateToken(user: { user_id: string; user_type: string; roles: string[]; unit_id?: string | null }): string {
  return jwt.sign(
    { userId: user.user_id, userType: user.user_type, roles: user.roles, unitId: user.unit_id || null, jti: randomUUID() },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "30m" } as SignOptions
  );
}

export function setAuthCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 1800,
  });
}

export function clearAuthCookie(reply: FastifyReply): void {
  reply.clearCookie(COOKIE_NAME, { path: "/" });
}

export async function checkTokenRevocation(jti: string, userId: string, iat: number): Promise<boolean> {
  // Check if the specific token JTI is in the denylist
  const denyResult = await query(
    "SELECT 1 FROM auth_token_denylist WHERE jti = $1",
    [jti]
  );
  if (denyResult.rows.length > 0) return true;

  // Check if the user has revoked all tokens issued before a certain time
  const userResult = await query(
    "SELECT tokens_revoked_before FROM user_account WHERE user_id = $1",
    [userId]
  );
  if (userResult.rows.length > 0 && userResult.rows[0].tokens_revoked_before) {
    const revokedBefore = new Date(userResult.rows[0].tokens_revoked_before).getTime() / 1000;
    if (iat < revokedBefore) return true;
  }

  return false;
}

export async function revokeToken(jti: string, userId: string, expiresAt: Date): Promise<void> {
  await query(
    "INSERT INTO auth_token_denylist (jti, user_id, expires_at) VALUES ($1, $2, $3) ON CONFLICT (jti) DO NOTHING",
    [jti, userId, expiresAt]
  );
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  await query(
    "UPDATE user_account SET tokens_revoked_before = NOW() WHERE user_id = $1",
    [userId]
  );
}

async function checkSessionInactivity(jti: string, userId: string): Promise<boolean> {
  const result = await query(
    "SELECT last_activity_at FROM auth_session_activity WHERE jti = $1",
    [jti]
  );
  if (result.rows.length === 0) return false; // First request — no inactivity yet
  const lastActivity = new Date(result.rows[0].last_activity_at).getTime();
  return Date.now() - lastActivity > INACTIVITY_TIMEOUT_MS;
}

async function updateSessionActivity(jti: string, userId: string): Promise<void> {
  try {
    await query(
      `INSERT INTO auth_session_activity (jti, user_id, last_activity_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (jti) DO UPDATE SET last_activity_at = NOW()
       WHERE auth_session_activity.last_activity_at < NOW() - INTERVAL '1 minute'`,
      [jti, userId]
    );
  } catch (err) {
    // Non-critical: log but don't block the request
    if (typeof process !== "undefined" && process.env.NODE_ENV !== "test") {
      console.warn("[AUTH] Failed to update session activity:", err);
    }
  }
}

export function registerAuthMiddleware(app: FastifyInstance): void {
  app.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
    const url = request.url.split("?")[0];
    if (PUBLIC_ROUTES.some((r) => url === r)) return;

    const authHeader = request.headers.authorization;
    const cookieToken = (request.cookies as Record<string, string> | undefined)?.forensic_auth;
    const token = cookieToken || (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null);
    if (!token) {
      reply.code(401).send({ error: "AUTHENTICATION_REQUIRED", message: "Missing authentication", statusCode: 401 });
      return;
    }
    const payload = verifyToken(token);
    if (!payload) {
      reply.code(401).send({ error: "INVALID_TOKEN", message: "Token is invalid or expired", statusCode: 401 });
      return;
    }

    // Check if token has been revoked
    const decoded = jwt.decode(token) as JwtPayload | null;
    const iat = decoded?.iat || 0;
    if (payload.jti) {
      const isRevoked = await checkTokenRevocation(payload.jti, payload.userId, iat);
      if (isRevoked) {
        reply.code(401).send({ error: "TOKEN_REVOKED", message: "Token has been revoked", statusCode: 401 });
        return;
      }

      // Check session inactivity (15-minute timeout)
      const isInactive = await checkSessionInactivity(payload.jti, payload.userId);
      if (isInactive) {
        reply.code(401).send({ error: "SESSION_INACTIVE", message: "Session expired due to inactivity", statusCode: 401 });
        return;
      }

      // Update last activity (throttled to once per minute)
      updateSessionActivity(payload.jti, payload.userId);
    }

    request.authUser = payload;
    request.authToken = token;
  });
}
