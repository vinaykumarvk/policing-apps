import { randomUUID } from "node:crypto";
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import jwt, { JwtPayload } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dopams-dev-secret-DO-NOT-USE-IN-PRODUCTION";
const COOKIE_NAME = "dopams_auth";

const PUBLIC_ROUTES = [
  "/health",
  "/ready",
  "/api/v1/auth/login",
  "/api/v1/auth/logout",
];

export interface AuthPayload {
  userId: string;
  userType: string;
  roles: string[];
  jti: string;
}

declare module "fastify" {
  interface FastifyRequest {
    authUser?: AuthPayload;
    authToken?: string;
  }
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    if (!payload.userId || !payload.userType) return null;
    return {
      userId: payload.userId as string,
      userType: payload.userType as string,
      roles: (payload.roles as string[]) || [],
      jti: (payload.jti as string) || "",
    };
  } catch {
    return null;
  }
}

export function generateToken(user: { user_id: string; user_type: string; roles: string[] }): string {
  return jwt.sign(
    { userId: user.user_id, userType: user.user_type, roles: user.roles, jti: randomUUID() },
    JWT_SECRET,
    { expiresIn: (process.env.JWT_EXPIRES_IN || "24h") as any }
  );
}

export function setAuthCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 86400,
  });
}

export function clearAuthCookie(reply: FastifyReply): void {
  reply.clearCookie(COOKIE_NAME, { path: "/" });
}

export function registerAuthMiddleware(app: FastifyInstance): void {
  app.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
    const url = request.url.split("?")[0];
    if (PUBLIC_ROUTES.some((r) => url === r) || url.startsWith("/api/v1/auth/")) return;

    const authHeader = request.headers.authorization;
    const cookieToken = (request.cookies as Record<string, string> | undefined)?.dopams_auth;
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
    request.authUser = payload;
    request.authToken = token;
  });
}
