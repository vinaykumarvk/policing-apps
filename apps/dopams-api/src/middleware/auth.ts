import { createAuthMiddleware } from "@puda/api-core";
import { query } from "../db";

// Re-export types so existing imports still work
export type { AuthPayload } from "@puda/api-core";

/** Single source of truth for the dev-only JWT secret. Import this constant
 *  whenever you need to create an auth middleware instance elsewhere (e.g.
 *  LDAP, OIDC conditional blocks in app.ts). */
export const DEV_JWT_SECRET = "dopams-dev-secret-DO-NOT-USE-IN-PRODUCTION";

const auth = createAuthMiddleware({
  cookieName: "dopams_auth",
  defaultDevSecret: DEV_JWT_SECRET,
  queryFn: query,
});

export const verifyToken = auth.verifyToken;
export const generateToken = auth.generateToken;
export const setAuthCookie = auth.setAuthCookie;
export const clearAuthCookie = auth.clearAuthCookie;
export const checkTokenRevocation = auth.checkTokenRevocation;
export const revokeToken = auth.revokeToken;
export const revokeAllUserTokens = auth.revokeAllUserTokens;

export function registerAuthMiddleware(app: import("fastify").FastifyInstance) {
  auth.register(app);
}
