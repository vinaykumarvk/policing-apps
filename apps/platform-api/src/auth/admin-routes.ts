// User-management routes, guarded by the platform/user:manage permission on
// the caller's minted claims. Every action emits a structured audit log line.
import { randomUUID } from "node:crypto";
import type { PlatformClaims } from "../../../../packages/authz/src";
import { generateTotpSecret, hashPassword } from "./crypto";
import type { IdentityAdminStore, PlatformUser } from "./identity";
import { findRoleTemplate, ROLE_TEMPLATES } from "./role-templates";

const ADMIN_PREFIX = "/api/v1/platform/admin/users";
const MIN_PASSWORD_LENGTH = 12;

export interface AdminRouteContext {
  store: IdentityAdminStore;
  claims: PlatformClaims;
}

export function callerCanManageUsers(claims: PlatformClaims): boolean {
  return claims.domain_permissions.some(
    (entry) => entry.domain === "platform" && entry.permissions.includes("user:manage"),
  );
}

export function isAdminRoute(pathname: string): boolean {
  return pathname === ADMIN_PREFIX || pathname.startsWith(`${ADMIN_PREFIX}/`);
}

export async function handleAdminRoute(
  request: Request,
  context: AdminRouteContext,
): Promise<Response> {
  const url = new URL(request.url);
  const segments = url.pathname.slice(ADMIN_PREFIX.length).split("/").filter(Boolean);

  if (request.method === "GET" && segments.length === 0) {
    const users = await context.store.listUsers();
    audit(context, "user:list", { count: users.length });
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
      return resetTotp(context, userId);
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
  audit(context, "user:create", { target: user.userId, username, role_template: template.id });
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
  audit(context, "user:status", { target: userId, status });
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
  audit(context, "user:reset-password", { target: userId });
  return json(200, { ok: true });
}

async function resetTotp(context: AdminRouteContext, userId: string): Promise<Response> {
  const user = await context.store.getUserById(userId);
  if (!user) {
    return json(404, { error: { code: "USER_NOT_FOUND" } });
  }
  const totpSecret = generateTotpSecret();
  await context.store.setTotpSecret(userId, totpSecret);
  audit(context, "user:reset-totp", { target: userId });
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

function audit(context: AdminRouteContext, action: string, detail: Record<string, unknown>): void {
  console.log(
    JSON.stringify({
      audit: "platform-user-admin",
      action,
      actor: context.claims.subject.user_id,
      session: context.claims.session_id,
      ...detail,
    }),
  );
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
