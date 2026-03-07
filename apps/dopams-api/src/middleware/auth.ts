import { createAuthMiddleware } from "@puda/api-core";
import { query } from "../db";

// Re-export types so existing imports still work
export type { AuthPayload } from "@puda/api-core";

const auth = createAuthMiddleware({
  cookieName: "dopams_auth",
  defaultDevSecret: "dopams-dev-secret-DO-NOT-USE-IN-PRODUCTION",
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
