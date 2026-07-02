import { createHmac, timingSafeEqual } from "node:crypto";
import { FastifyInstance } from "fastify";
import { createAuthRoutes } from "@puda/api-core";
import { createAuthMiddleware } from "@puda/api-core";
import { query } from "../db";
import { DEV_JWT_SECRET } from "../middleware/auth";

const auth = createAuthMiddleware({
  cookieName: "dopams_auth",
  defaultDevSecret: DEV_JWT_SECRET,
  queryFn: query,
});

const baseRegister = createAuthRoutes({ queryFn: query, auth });

interface PlatformSsoPayload {
  u: string;
  d: string;
  p: string;
  t: string;
  a: string;
  e: number;
}

/** Verifies a platform launch token (HMAC-SHA256, audience "dopams"). */
function verifyPlatformSsoToken(token: string, secret: string): PlatformSsoPayload | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const signature = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(createHmac("sha256", secret).update(payload).digest("base64url"));
  if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) return null;
  let parsed: PlatformSsoPayload;
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (parsed.a !== "dopams" || typeof parsed.e !== "number" || parsed.e <= Date.now()) return null;
  if (typeof parsed.u !== "string" || !parsed.u) return null;
  return parsed;
}

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  await baseRegister(app);

  // Platform SSO: exchange a launch token from the policing platform for a
  // local DOPAMS session. Maps the platform subject to a local user_account
  // (by username, falling back to PLATFORM_SSO_FALLBACK_USER for pilot users
  // that have no dedicated DOPAMS account yet).
  app.post("/api/v1/auth/platform-sso", {
    config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
    schema: {
      tags: ["auth"],
      body: {
        type: "object",
        additionalProperties: false,
        required: ["token"],
        properties: { token: { type: "string", minLength: 16, maxLength: 4096 } },
      },
    },
  }, async (request, reply) => {
    const secret = process.env.PLATFORM_SSO_SECRET;
    if (!secret) {
      reply.code(503);
      return { error: "PLATFORM_SSO_NOT_CONFIGURED", message: "Platform SSO is not enabled" };
    }
    const { token } = request.body as { token: string };
    const payload = verifyPlatformSsoToken(token, secret);
    if (!payload) {
      reply.code(401);
      return { error: "PLATFORM_SSO_TOKEN_INVALID", message: "Launch token is invalid or expired" };
    }

    const fallback = process.env.PLATFORM_SSO_FALLBACK_USER || "admin";
    const result = await query(
      `SELECT user_id, username, full_name, user_type, unit_id
         FROM user_account
        WHERE username = ANY($1) AND is_active = true
        ORDER BY CASE WHEN username = $2 THEN 0 ELSE 1 END
        LIMIT 1`,
      [[payload.u, fallback], payload.u],
    );
    const dbUser = result.rows[0];
    if (!dbUser) {
      reply.code(403);
      return { error: "PLATFORM_SSO_NO_LOCAL_USER", message: "No local user is mapped for this platform subject" };
    }
    const rolesResult = await query(
      `SELECT r.role_key FROM user_role ur JOIN role r ON r.role_id = ur.role_id WHERE ur.user_id = $1`,
      [dbUser.user_id],
    );
    const roles = rolesResult.rows.map((row: { role_key: string }) => row.role_key);
    const localToken = auth.generateToken({
      user_id: dbUser.user_id,
      user_type: dbUser.user_type,
      roles,
      unit_id: dbUser.unit_id,
    });
    auth.setAuthCookie(reply, localToken);
    request.log.info(
      { platformSubject: payload.u, tenant: payload.t, mappedUser: dbUser.username },
      "platform SSO login",
    );
    return { user: { ...dbUser, roles }, token: localToken };
  });

  // FR-01: LDAP authentication stub (schema-ready, awaits infrastructure)
  app.post("/api/v1/auth/ldap", {
    schema: {
      tags: ["auth"],
      body: {
        type: "object",
        additionalProperties: false,
        required: ["username", "password", "domain"],
        properties: {
          username: { type: "string", minLength: 1, maxLength: 255 },
          password: { type: "string", minLength: 1 },
          domain: { type: "string", minLength: 1, maxLength: 255 },
        },
      },
    },
  }, async (_request, reply) => {
    reply.code(501);
    return {
      error: "LDAP_NOT_CONFIGURED",
      message: "LDAP integration requires infrastructure setup",
    };
  });
}
