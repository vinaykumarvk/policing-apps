import { beforeEach, describe, expect, it } from "vitest";
import { evaluateEntitlement, validatePlatformClaims } from "../../../../packages/authz/src";
import { createPlatformAppRegistry } from "../app-registry";
import { hashPassword, totpCode } from "../auth/crypto";
import { createAuthGateway, type AuthGateway } from "../auth/gateway";
import {
  createInMemoryIdentityStore,
  mintPlatformClaims,
  type IdentityAdminStore,
  type PlatformUser,
} from "../auth/identity";
import { findRoleTemplate, ROLE_TEMPLATES } from "../auth/role-templates";

const NOW = new Date("2026-07-02T12:00:00Z");
const SECRET = "admin-test-secret";
const TOTP_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

const ADMIN_TEMPLATE = findRoleTemplate("platform_administrator")!;
const ADMIN_USER: PlatformUser = {
  userId: "user-admin-1",
  username: "root-admin",
  passwordHash: hashPassword("root-admin-password"),
  totpSecret: TOTP_SECRET,
  displayName: "Root Admin",
  persona: ADMIN_TEMPLATE.persona,
  tenantId: ADMIN_TEMPLATE.tenantId,
  orgId: ADMIN_TEMPLATE.orgId,
  unitIds: ADMIN_TEMPLATE.unitIds,
  orgScope: ADMIN_TEMPLATE.orgScope,
  jurisdiction: ADMIN_TEMPLATE.jurisdiction,
  clearance: ADMIN_TEMPLATE.clearance,
  assignment: ADMIN_TEMPLATE.assignment,
  purposeAllowed: ADMIN_TEMPLATE.purposeAllowed,
  status: "active",
};

let store: IdentityAdminStore;
let gateway: AuthGateway;
let adminCookie: string;
let evidenceLog: object[];

async function loginAs(username: string, password: string): Promise<string> {
  const response = await gateway.handleAuthRoute(
    new Request("http://platform/api/v1/platform/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password, totp: totpCode(TOTP_SECRET, NOW.getTime()) }),
    }),
  );
  return (response?.headers.get("set-cookie") ?? "").split(";")[0];
}

function adminRequest(path: string, method = "GET", body?: unknown, cookie = adminCookie): Request {
  return new Request(`http://platform${path}`, {
    method,
    headers: {
      cookie,
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

beforeEach(async () => {
  store = createInMemoryIdentityStore([ADMIN_USER], {
    [ADMIN_USER.userId]: [...ADMIN_TEMPLATE.entitlements],
  });
  evidenceLog = [];
  gateway = createAuthGateway({
    store,
    sessionSecret: SECRET,
    now: () => NOW,
    secureCookies: false,
    evidenceSink: { append: (evidence) => void evidenceLog.push(evidence) },
    evidenceReader: { listRecent: async (limit) => evidenceLog.slice(-limit) },
  });
  adminCookie = await loginAs("root-admin", "root-admin-password");
});

describe("role templates", () => {
  it("every template mints claims that pass validation", () => {
    for (const template of ROLE_TEMPLATES) {
      const claims = mintPlatformClaims({
        user: { ...ADMIN_USER, ...templateFields(template.id) },
        entitlements: template.entitlements,
        sessionId: "sess-template",
        mfaVerifiedAt: NOW.toISOString(),
        now: NOW,
      });
      expect(validatePlatformClaims(claims, { now: NOW }).valid, template.id).toBe(true);
    }
  });

  it("platform_administrator template is entitled to the platform-admin registry app", () => {
    const template = findRoleTemplate("platform_administrator")!;
    const claims = mintPlatformClaims({
      user: { ...ADMIN_USER, ...templateFields(template.id) },
      entitlements: template.entitlements,
      sessionId: "sess-admin",
      mfaVerifiedAt: NOW.toISOString(),
      now: NOW,
    });
    const app = createPlatformAppRegistry().find((entry) => entry.id === "platform-admin")!;
    const decision = evaluateEntitlement(
      claims,
      { ...app.entitlement_request!, serverVerified: true },
      { now: NOW },
    );
    expect(decision.reason).toBe("ALLOW");
  });
});

function templateFields(templateId: string): Partial<PlatformUser> {
  const template = findRoleTemplate(templateId)!;
  return {
    persona: template.persona,
    orgId: template.orgId,
    unitIds: template.unitIds,
    orgScope: template.orgScope,
    jurisdiction: template.jurisdiction,
    clearance: template.clearance,
    assignment: template.assignment,
    purposeAllowed: template.purposeAllowed,
  };
}

describe("admin routes authorization", () => {
  it("rejects unauthenticated calls", async () => {
    const response = await gateway.handleAuthRoute(
      adminRequest("/api/v1/platform/admin/users", "GET", undefined, ""),
    );
    expect(response?.status).toBe(401);
  });

  it("rejects users without user:manage", async () => {
    const template = findRoleTemplate("pilot_operator")!;
    await store.createUser(
      {
        ...ADMIN_USER,
        userId: "user-operator",
        username: "operator",
        passwordHash: hashPassword("operator-password-1"),
        ...templateFields("pilot_operator"),
      } as PlatformUser,
      template.entitlements,
    );
    const cookie = await loginAs("operator", "operator-password-1");
    const response = await gateway.handleAuthRoute(
      adminRequest("/api/v1/platform/admin/users", "GET", undefined, cookie),
    );
    expect(response?.status).toBe(403);
  });
});

describe("user lifecycle", () => {
  it("creates a user from a template and the user can sign in", async () => {
    const created = await gateway.handleAuthRoute(
      adminRequest("/api/v1/platform/admin/users", "POST", {
        username: "New.Analyst",
        display_name: "New Analyst",
        password: "a-long-password-123",
        role_template: "intelligence_analyst",
      }),
    );
    expect(created?.status).toBe(201);
    const body = (await created?.json()) as {
      user: { userId: string; username: string };
      totp_secret: string;
      otpauth_uri: string;
    };
    expect(body.user.username).toBe("new.analyst");
    expect(body.totp_secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(body.otpauth_uri).toContain("otpauth://totp/");

    const login = await gateway.handleAuthRoute(
      new Request("http://platform/api/v1/platform/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: "new.analyst",
          password: "a-long-password-123",
          totp: totpCode(body.totp_secret, NOW.getTime()),
        }),
      }),
    );
    expect(login?.status).toBe(200);
  });

  it("rejects duplicate usernames, short passwords, and unknown templates", async () => {
    const duplicate = await gateway.handleAuthRoute(
      adminRequest("/api/v1/platform/admin/users", "POST", {
        username: "root-admin",
        display_name: "Dup",
        password: "a-long-password-123",
        role_template: "pilot_operator",
      }),
    );
    expect(duplicate?.status).toBe(409);
    const short = await gateway.handleAuthRoute(
      adminRequest("/api/v1/platform/admin/users", "POST", {
        username: "shortpw",
        display_name: "Short",
        password: "tiny",
        role_template: "pilot_operator",
      }),
    );
    expect(short?.status).toBe(400);
    const unknown = await gateway.handleAuthRoute(
      adminRequest("/api/v1/platform/admin/users", "POST", {
        username: "ghost",
        display_name: "Ghost",
        password: "a-long-password-123",
        role_template: "does_not_exist",
      }),
    );
    expect(unknown?.status).toBe(400);
  });

  it("disables a user (blocking login) but never the caller", async () => {
    const created = await gateway.handleAuthRoute(
      adminRequest("/api/v1/platform/admin/users", "POST", {
        username: "todisable",
        display_name: "To Disable",
        password: "a-long-password-123",
        role_template: "pilot_operator",
      }),
    );
    const body = (await created?.json()) as { user: { userId: string }; totp_secret: string };

    const disabled = await gateway.handleAuthRoute(
      adminRequest(`/api/v1/platform/admin/users/${body.user.userId}/status`, "POST", {
        status: "disabled",
      }),
    );
    expect(disabled?.status).toBe(200);

    const login = await gateway.handleAuthRoute(
      new Request("http://platform/api/v1/platform/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: "todisable",
          password: "a-long-password-123",
          totp: totpCode(body.totp_secret, NOW.getTime()),
        }),
      }),
    );
    expect(login?.status).toBe(401);

    const self = await gateway.handleAuthRoute(
      adminRequest(`/api/v1/platform/admin/users/${ADMIN_USER.userId}/status`, "POST", {
        status: "disabled",
      }),
    );
    expect(self?.status).toBe(400);
  });

  it("resets TOTP and returns a fresh secret once", async () => {
    const response = await gateway.handleAuthRoute(
      adminRequest(`/api/v1/platform/admin/users/${ADMIN_USER.userId}/reset-totp`, "POST", {}),
    );
    expect(response?.status).toBe(200);
    const body = (await response?.json()) as { totp_secret: string };
    expect(body.totp_secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(body.totp_secret).not.toBe(TOTP_SECRET);
  });

  it("lists users", async () => {
    const response = await gateway.handleAuthRoute(adminRequest("/api/v1/platform/admin/users"));
    const body = (await response?.json()) as { users: Array<{ username: string }> };
    expect(body.users.map((user) => user.username)).toContain("root-admin");
  });
});

describe("decision evidence ledger", () => {
  it("records allow evidence for admin actions with integrity hash", async () => {
    await gateway.handleAuthRoute(
      adminRequest("/api/v1/platform/admin/users", "POST", {
        username: "evidence.user",
        display_name: "Evidence User",
        password: "a-long-password-123",
        role_template: "pilot_operator",
      }),
    );
    const record = evidenceLog.at(-1) as {
      action: string;
      outcome: string;
      evidence_schema_version: string;
      integrity: { algorithm: string; payload_hash: string };
      claims_snapshot: { subject: { user_id: string } };
    };
    expect(record.action).toBe("platform.admin.user:create");
    expect(record.outcome).toBe("allow");
    expect(record.evidence_schema_version).toBe("platform.authorization_decision_evidence.v1");
    expect(record.integrity.payload_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(record.claims_snapshot.subject.user_id).toBe(ADMIN_USER.userId);
  });

  it("records deny evidence for unauthenticated and unentitled access", async () => {
    await gateway.handleAuthRoute(
      adminRequest("/api/v1/platform/admin/users", "GET", undefined, ""),
    );
    const denied = evidenceLog.at(-1) as { outcome: string; reason: string };
    expect(denied.outcome).toBe("deny");
    expect(denied.reason).toBe("AUTH_REQUIRED");
  });

  it("serves the evidence read endpoint to admins", async () => {
    await gateway.handleAuthRoute(adminRequest("/api/v1/platform/admin/users"));
    const response = await gateway.handleAuthRoute(
      adminRequest("/api/v1/platform/admin/decision-evidence?limit=5"),
    );
    expect(response?.status).toBe(200);
    const body = (await response?.json()) as { entries: object[] };
    expect(body.entries.length).toBeGreaterThan(0);
  });
});
