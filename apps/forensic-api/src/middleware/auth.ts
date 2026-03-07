import { createAuthMiddleware } from "@puda/api-core";
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { query } from "../db";

export type { AuthPayload } from "@puda/api-core";

const auth = createAuthMiddleware({
  cookieName: "forensic_auth",
  defaultDevSecret: "forensic-dev-secret-DO-NOT-USE-IN-PRODUCTION",
  queryFn: query,
});

export const verifyToken = auth.verifyToken;
export const generateToken = auth.generateToken;
export const setAuthCookie = auth.setAuthCookie;
export const clearAuthCookie = auth.clearAuthCookie;
export const checkTokenRevocation = auth.checkTokenRevocation;
export const revokeToken = auth.revokeToken;
export const revokeAllUserTokens = auth.revokeAllUserTokens;

export function registerAuthMiddleware(app: FastifyInstance) {
  auth.register(app);
}

// Step-up authentication for sensitive operations
const STEPUP_ACTIONS = ["evidence_delete", "purge_approve", "data_export", "config_change", "report_publish", "admin_action"];
const STEPUP_VALIDITY_MINUTES = 15;

export async function requireStepUp(
  userId: string,
  actionType: string,
): Promise<{ valid: boolean; sessionId?: string }> {
  if (!STEPUP_ACTIONS.includes(actionType)) {
    return { valid: true };
  }

  const result = await query(
    `SELECT session_id FROM stepup_session
     WHERE user_id = $1 AND action_type = $2 AND expires_at > NOW()
     ORDER BY verified_at DESC LIMIT 1`,
    [userId, actionType],
  );

  if (result.rows.length > 0) {
    return { valid: true, sessionId: result.rows[0].session_id };
  }
  return { valid: false };
}

export async function createStepUpSession(
  userId: string,
  actionType: string,
): Promise<string> {
  const result = await query(
    `INSERT INTO stepup_session (user_id, action_type, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '1 minute' * $3)
     RETURNING session_id`,
    [userId, actionType, STEPUP_VALIDITY_MINUTES],
  );
  return result.rows[0].session_id;
}

// ── FR-14: MFA Step-up Enforcement for Privileged Operations ──

/**
 * Route patterns that require MFA revalidation before execution.
 * Matches: DELETE evidence, publish reports, admin endpoints.
 */
const MFA_REQUIRED_PATTERNS: Array<{ method: string; pattern: RegExp; actionType: string }> = [
  { method: "DELETE", pattern: /^\/api\/v1\/evidence\//, actionType: "evidence_delete" },
  { method: "POST", pattern: /^\/api\/v1\/reports\/[^/]+\/transition$/, actionType: "report_publish" },
  { method: "POST", pattern: /^\/api\/v1\/admin\//, actionType: "admin_action" },
  { method: "PUT", pattern: /^\/api\/v1\/admin\//, actionType: "admin_action" },
  { method: "PATCH", pattern: /^\/api\/v1\/admin\//, actionType: "admin_action" },
  { method: "DELETE", pattern: /^\/api\/v1\/admin\//, actionType: "admin_action" },
  { method: "DELETE", pattern: /^\/api\/v1\/redaction-profiles\//, actionType: "config_change" },
  { method: "POST", pattern: /^\/api\/v1\/data-lifecycle\//, actionType: "purge_approve" },
];

/**
 * Register an onRequest hook that enforces MFA step-up for privileged operations.
 * Checks for a valid stepup_session; if none exists, returns 403 MFA_REQUIRED.
 */
export function registerMfaEnforcement(app: FastifyInstance) {
  app.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.authUser) return; // not authenticated yet — auth middleware will handle

    const url = request.url.split("?")[0];
    const method = request.method;

    const matchedRule = MFA_REQUIRED_PATTERNS.find(
      (rule) => rule.method === method && rule.pattern.test(url),
    );
    if (!matchedRule) return; // not a privileged route

    const stepUp = await requireStepUp(request.authUser.userId, matchedRule.actionType);
    if (!stepUp.valid) {
      reply.code(403).send({
        error: "MFA_REQUIRED",
        message: "This operation requires MFA verification",
        statusCode: 403,
      });
    }
  });
}
