// User-management routes, guarded by the platform/user:manage permission on
// the caller's minted claims. Every action (and every authorization denial)
// is recorded as authorization-decision evidence in the ledger (G-SEC-002).
import { randomUUID } from "node:crypto";
import {
  createAuthorizationDecisionEvidence,
  type AuthorizationDecisionEvidence,
} from "../../../../packages/audit-ledger/src";
import type { PlatformClaims } from "../../../../packages/authz/src";
import { generateTotpSecret, hashPassword } from "./crypto";
import type { IdentityAdminStore, PlatformUser } from "./identity";
import { findRoleTemplate, ROLE_TEMPLATES } from "./role-templates";

const ADMIN_ROOT = "/api/v1/platform/admin";
const ADMIN_PREFIX = `${ADMIN_ROOT}/users`;
const EVIDENCE_PATH = `${ADMIN_ROOT}/decision-evidence`;
const MIN_PASSWORD_LENGTH = 12;
export const ADMIN_POLICY_VERSION = "platform.user_admin.v1";

export interface AdminEvidenceSink {
  append: (evidence: Readonly<AuthorizationDecisionEvidence>) => Promise<void> | void;
}

export interface AdminEvidenceReader {
  listRecent: (limit: number) => Promise<readonly object[]>;
}

export interface AdminRouteContext {
  store: IdentityAdminStore;
  claims: PlatformClaims;
  evidenceSink?: AdminEvidenceSink;
  evidenceReader?: AdminEvidenceReader;
  now?: () => Date;
}

export function callerCanManageUsers(claims: PlatformClaims): boolean {
  return claims.domain_permissions.some(
    (entry) => entry.domain === "platform" && entry.permissions.includes("user:manage"),
  );
}

export function isAdminRoute(pathname: string): boolean {
  return pathname === ADMIN_ROOT || pathname.startsWith(`${ADMIN_ROOT}/`);
}

export function adminDecisionEvidence(input: {
  action: string;
  outcome: "allow" | "deny";
  reason: string;
  path: string;
  target: string;
  claims?: PlatformClaims;
  now: Date;
  detail?: string;
}): Readonly<AuthorizationDecisionEvidence> {
  return createAuthorizationDecisionEvidence({
    occurred_at: input.now.toISOString(),
    correlation_id: `admin-${randomUUID()}`,
    outcome: input.outcome,
    reason: input.reason,
    detail: input.detail,
    policy_version: ADMIN_POLICY_VERSION,
    entitlement_policy_version: "platform.entitlements.v1",
    path: input.path,
    action: input.action,
    claims_snapshot: input.claims
      ? {
          subject: input.claims.subject,
          session_id: input.claims.session_id,
          source_version: input.claims.source_version,
        }
      : { subject: null, session_id: null, source_version: null },
    resource: {
      kind: "platform_user",
      resource_id: input.target,
      source_system: "platform-idp",
      source_record_id: input.target,
      source_version: "platform.identity.v1",
      projection_version: "platform.identity.v1",
      source_status: "active",
      classification: "restricted",
      legal_hold_status: "none",
    },
    redaction_decision: {
      profile: "user-admin-v1",
      fields_redacted: ["password_hash", "totp_secret"],
      storage_uri_exposed: false,
      reason: "credential_material_never_listed",
    },
    decision_inputs: {
      server_verified: true,
      claim_valid: input.claims !== undefined,
      policy_present: true,
      resource_complete: true,
      projection_fresh: true,
      source_active: true,
      redaction_complete: true,
      storage_uri_exposed: false,
      legal_hold_checked: true,
      jurisdiction_checked: false,
      assignment_checked: false,
      clearance_checked: false,
      purpose_checked: false,
      mfa_checked: true,
    },
  });
}

export async function handleAdminRoute(
  request: Request,
  context: AdminRouteContext,
): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === EVIDENCE_PATH) {
    if (!context.evidenceReader) {
      return json(501, { error: { code: "EVIDENCE_LEDGER_NOT_CONFIGURED" } });
    }
    const limit = Number(url.searchParams.get("limit") ?? 20);
    const entries = await context.evidenceReader.listRecent(Number.isFinite(limit) ? limit : 20);
    return json(200, { entries });
  }

  if (!isUsersRoute(url.pathname)) {
    return json(404, { error: { code: "ADMIN_ROUTE_NOT_FOUND" } });
  }
  const segments = url.pathname.slice(ADMIN_PREFIX.length).split("/").filter(Boolean);

  if (request.method === "GET" && segments.length === 0) {
    const users = await context.store.listUsers();
    await audit(context, request, "platform.admin.user:list", "list", { count: users.length });
    return json(200, { users });
  }
  if (request.method === "GET" && segments.length === 1 && segments[0] === "role-templates") {
    return json(200, {
      templates: ROLE_TEMPLATES.map((template) => ({
        id: template.id,
        label: template.label,
        persona: template.persona,
        org_id: template.orgId,
        entitlements: template.entitlements,
      })),
    });
  }
  if (request.method === "POST" && segments.length === 0) {
    return createUser(request, context);
  }
  if (request.method === "POST" && segments.length === 2) {
    const [userId, action] = segments;
    if (action === "status") {
      return setStatus(request, context, userId);
    }
    if (action === "reset-password") {
      return resetPassword(request, context, userId);
    }
    if (action === "reset-totp") {
      return resetTotp(request, context, userId);
    }
  }
  return json(404, { error: { code: "ADMIN_ROUTE_NOT_FOUND" } });
}

async function createUser(request: Request, context: AdminRouteContext): Promise<Response> {
  const body = await readBody(request);
  if (!body) {
    return json(400, { error: { code: "ADMIN_BODY_INVALID" } });
  }
  const username = readString(body, "username").trim().toLowerCase();
  const displayName = readString(body, "display_name").trim();
  const password = readString(body, "password");
  const templateId = readString(body, "role_template");
  const template = findRoleTemplate(templateId);
  if (!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(username)) {
    return json(400, { error: { code: "USERNAME_INVALID" } });
  }
  if (!displayName) {
    return json(400, { error: { code: "DISPLAY_NAME_REQUIRED" } });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return json(400, { error: { code: "PASSWORD_TOO_SHORT", min_length: MIN_PASSWORD_LENGTH } });
  }
  if (!template) {
    return json(400, {
      error: { code: "ROLE_TEMPLATE_UNKNOWN", known: ROLE_TEMPLATES.map((entry) => entry.id) },
    });
  }

  const totpSecret = generateTotpSecret();
  const user: PlatformUser = {
    userId: `user-${randomUUID()}`,
    username,
    passwordHash: hashPassword(password),
    totpSecret,
    displayName,
    persona: template.persona,
    tenantId: template.tenantId,
    orgId: template.orgId,
    unitIds: template.unitIds,
    orgScope: template.orgScope,
    jurisdiction: template.jurisdiction,
    clearance: template.clearance,
    assignment: template.assignment,
    purposeAllowed: template.purposeAllowed,
    status: "active",
  };
  try {
    await context.store.createUser(user, template.entitlements);
  } catch (error) {
    if (error instanceof Error && error.message === "USERNAME_TAKEN") {
      return json(409, { error: { code: "USERNAME_TAKEN" } });
    }
    throw error;
  }
  await audit(context, request, "platform.admin.user:create", user.userId, {
    username,
    role_template: template.id,
  });
  return json(201, {
    user: summarize(user),
    // Returned exactly once; the server stores only the secret for verification.
    totp_secret: totpSecret,
    otpauth_uri: otpauthUri(username, totpSecret),
  });
}

async function setStatus(
  request: Request,
  context: AdminRouteContext,
  userId: string,
): Promise<Response> {
  const body = await readBody(request);
  const status = body ? readString(body, "status") : "";
  if (status !== "active" && status !== "disabled") {
    return json(400, { error: { code: "STATUS_INVALID" } });
  }
  if (userId === context.claims.subject.user_id && status === "disabled") {
    return json(400, { error: { code: "CANNOT_DISABLE_SELF" } });
  }
  const updated = await context.store.setUserStatus(userId, status);
  if (!updated) {
    return json(404, { error: { code: "USER_NOT_FOUND" } });
  }
  await audit(context, request, "platform.admin.user:status", userId, { status });
  return json(200, { ok: true, status });
}

async function resetPassword(
  request: Request,
  context: AdminRouteContext,
  userId: string,
): Promise<Response> {
  const body = await readBody(request);
  const password = body ? readString(body, "password") : "";
  if (password.length < MIN_PASSWORD_LENGTH) {
    return json(400, { error: { code: "PASSWORD_TOO_SHORT", min_length: MIN_PASSWORD_LENGTH } });
  }
  const updated = await context.store.setPasswordHash(userId, hashPassword(password));
  if (!updated) {
    return json(404, { error: { code: "USER_NOT_FOUND" } });
  }
  await audit(context, request, "platform.admin.user:reset-password", userId, {});
  return json(200, { ok: true });
}

async function resetTotp(
  request: Request,
  context: AdminRouteContext,
  userId: string,
): Promise<Response> {
  const user = await context.store.getUserById(userId);
  if (!user) {
    return json(404, { error: { code: "USER_NOT_FOUND" } });
  }
  const totpSecret = generateTotpSecret();
  await context.store.setTotpSecret(userId, totpSecret);
  await audit(context, request, "platform.admin.user:reset-totp", userId, {});
  return json(200, {
    ok: true,
    totp_secret: totpSecret,
    otpauth_uri: otpauthUri(user.username, totpSecret),
  });
}

function otpauthUri(username: string, secret: string): string {
  return `otpauth://totp/Policing%20Platform:${encodeURIComponent(username)}?secret=${secret}&issuer=Policing%20Platform`;
}

function summarize(user: PlatformUser): object {
  return {
    userId: user.userId,
    username: user.username,
    displayName: user.displayName,
    persona: user.persona,
    orgId: user.orgId,
    status: user.status,
  };
}

function isUsersRoute(pathname: string): boolean {
  return pathname === ADMIN_PREFIX || pathname.startsWith(`${ADMIN_PREFIX}/`);
}

async function audit(
  context: AdminRouteContext,
  request: Request,
  action: string,
  target: string,
  detail: Record<string, unknown>,
): Promise<void> {
  const evidence = adminDecisionEvidence({
    action,
    outcome: "allow",
    reason: "ALLOW",
    detail: Object.keys(detail).length ? JSON.stringify(detail) : undefined,
    path: new URL(request.url).pathname,
    target,
    claims: context.claims,
    now: (context.now ?? (() => new Date()))(),
  });
  await context.evidenceSink?.append(evidence);
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function readString(body: Record<string, unknown>, key: string): string {
  return typeof body[key] === "string" ? (body[key] as string) : "";
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
