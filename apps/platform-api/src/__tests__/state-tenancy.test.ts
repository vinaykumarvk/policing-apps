import { describe, expect, it } from "vitest";
import { evaluateEntitlement, validatePlatformClaims } from "../../../../packages/authz/src";
import { createPlatformAppRegistry, entitlementRequestForTenant } from "../app-registry";
import { hashPassword } from "../auth/crypto";
import { mintPlatformClaims, type PlatformUser } from "../auth/identity";
import { findRoleTemplate, ROLE_TEMPLATES, STATE_PROFILES } from "../auth/role-templates";

const NOW = new Date("2026-07-02T12:00:00Z");

function userFromTemplate(templateId: string): PlatformUser {
  const template = findRoleTemplate(templateId)!;
  return {
    userId: `user-${templateId}`,
    username: templateId,
    passwordHash: hashPassword("a-long-password-123"),
    totpSecret: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ",
    displayName: template.label,
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
}

function claimsFor(templateId: string) {
  const template = findRoleTemplate(templateId)!;
  return mintPlatformClaims({
    user: userFromTemplate(templateId),
    entitlements: template.entitlements,
    sessionId: `sess-${templateId}`,
    mfaVerifiedAt: NOW.toISOString(),
    now: NOW,
  });
}

describe("state-wise tenancy", () => {
  it("registers state template sets for every state profile", () => {
    for (const profile of STATE_PROFILES) {
      const ids = ROLE_TEMPLATES.filter((template) => template.tenantId === profile.tenantId).map(
        (template) => template.id,
      );
      expect(ids, profile.stateId).toContain(`${profile.stateId}_pilot_operator`);
      expect(ids, profile.stateId).toContain(`${profile.stateId}_forensic_analyst`);
    }
  });

  it("every state template mints valid claims", () => {
    for (const profile of STATE_PROFILES) {
      for (const template of ROLE_TEMPLATES.filter((entry) => entry.tenantId === profile.tenantId)) {
        const claims = claimsFor(template.id);
        expect(validatePlatformClaims(claims, { now: NOW }).valid, template.id).toBe(true);
      }
    }
  });

  it("kerala pilot operator is allowed on dopams via the kerala tenant context", () => {
    const claims = claimsFor("kerala_pilot_operator");
    const dopams = createPlatformAppRegistry().find((app) => app.id === "dopams")!;
    const request = entitlementRequestForTenant(dopams, "kerala-police")!;
    expect(request.org_id).toBe("ernakulam-district");
    const decision = evaluateEntitlement(claims, { ...request, serverVerified: true }, { now: NOW });
    expect(decision.reason).toBe("ALLOW");
  });

  it("kerala operator is denied against the punjab default context (cross-state isolation)", () => {
    const claims = claimsFor("kerala_pilot_operator");
    const dopams = createPlatformAppRegistry().find((app) => app.id === "dopams")!;
    const decision = evaluateEntitlement(
      claims,
      { ...dopams.entitlement_request!, serverVerified: true },
      { now: NOW },
    );
    expect(decision.allowed).toBe(false);
  });

  it("telangana pilot operator is allowed on iqw via the telangana tenant context", () => {
    const claims = claimsFor("telangana_pilot_operator");
    const iqw = createPlatformAppRegistry().find((app) => app.id === "iqw")!;
    const request = entitlementRequestForTenant(iqw, "telangana-police")!;
    expect(request.org_id).toBe("hyderabad-district");
    const decision = evaluateEntitlement(claims, { ...request, serverVerified: true }, { now: NOW });
    expect(decision.reason).toBe("ALLOW");
  });

  it("unknown tenants fall back to the default (punjab) context", () => {
    const dopams = createPlatformAppRegistry().find((app) => app.id === "dopams")!;
    expect(entitlementRequestForTenant(dopams, "goa-police")).toBe(dopams.entitlement_request);
    expect(entitlementRequestForTenant(dopams, null)).toBe(dopams.entitlement_request);
  });
});

describe("launch routes", async () => {
  const { createLaunchRouter } = await import("../auth/launch-routes");

  const evidenceLog: Array<{ action: string; outcome: string }> = [];
  const router = createLaunchRouter({
    targets: { dopams: "https://dopams.example.gov", iqw: "https://iqw.example.gov" },
    evidenceSink: {
      append: (evidence) => void evidenceLog.push(evidence as { action: string; outcome: string }),
    },
    now: () => NOW,
  });

  it("redirects entitled users to the destination app and records allow evidence", async () => {
    const claims = claimsFor("kerala_pilot_operator");
    const response = await router.handle(new Request("http://web/domains/dopams"), claims);
    expect(response?.status).toBe(302);
    expect(response?.headers.get("location")).toBe("https://dopams.example.gov");
    expect(evidenceLog.at(-1)).toMatchObject({ action: "platform.launch.dopams", outcome: "allow" });
  });

  it("denies launches outside the user's entitlements with evidence", async () => {
    const claims = claimsFor("kerala_forensic_analyst");
    const response = await router.handle(new Request("http://web/domains/dopams"), claims);
    expect(response?.status).toBe(403);
    expect(evidenceLog.at(-1)).toMatchObject({ action: "platform.launch.dopams", outcome: "deny" });
  });

  it("sends unauthenticated launches back to the shell login", async () => {
    const response = await router.handle(new Request("http://web/domains/dopams"), null);
    expect(response?.status).toBe(302);
    expect(response?.headers.get("location")).toBe("/");
  });

  it("404s unknown launch slugs and ignores non-launch paths", async () => {
    const unknown = await router.handle(new Request("http://web/domains/nope"), null);
    expect(unknown?.status).toBe(404);
    expect(await router.handle(new Request("http://web/other"), null)).toBeNull();
  });
});

describe("sso launch tokens", async () => {
  const { createLaunchRouter, createSsoLaunchToken } = await import("../auth/launch-routes");
  const { createHmac } = await import("node:crypto");
  const SSO_SECRET = "sso-test-secret";

  it("appends a valid audience-bound token to dopams and iqw launches", async () => {
    const router = createLaunchRouter({
      targets: { dopams: "https://dopams.example.gov", iqw: "https://iqw.example.gov" },
      ssoSecret: SSO_SECRET,
      now: () => NOW,
    });
    const claims = claimsFor("kerala_pilot_operator");

    const dopams = await router.handle(new Request("http://web/domains/dopams"), claims);
    const dopamsUrl = new URL(dopams!.headers.get("location")!);
    const dopamsToken = dopamsUrl.searchParams.get("sso")!;
    expect(dopamsUrl.origin).toBe("https://dopams.example.gov");

    const iqw = await router.handle(new Request("http://web/domains/iqw"), claims);
    const iqwUrl = new URL(iqw!.headers.get("location")!);
    expect(iqwUrl.pathname).toBe("/sso");
    const iqwToken = iqwUrl.searchParams.get("token")!;

    for (const [token, audience] of [[dopamsToken, "dopams"], [iqwToken, "iqw"]] as const) {
      const [payload, signature] = [token.slice(0, token.lastIndexOf(".")), token.slice(token.lastIndexOf(".") + 1)];
      expect(createHmac("sha256", SSO_SECRET).update(payload).digest("base64url")).toBe(signature);
      const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
      expect(decoded.a).toBe(audience);
      expect(decoded.t).toBe("kerala-police");
      expect(decoded.e).toBeGreaterThan(NOW.getTime());
    }
  });

  it("omits tokens when no sso secret is configured", async () => {
    const router = createLaunchRouter({
      targets: { dopams: "https://dopams.example.gov" },
      now: () => NOW,
    });
    const response = await router.handle(
      new Request("http://web/domains/dopams"),
      claimsFor("kerala_pilot_operator"),
    );
    expect(response?.headers.get("location")).toBe("https://dopams.example.gov");
  });

  it("createSsoLaunchToken embeds the platform subject", () => {
    const token = createSsoLaunchToken(claimsFor("telangana_pilot_operator"), "dopams", SSO_SECRET, NOW.getTime());
    const decoded = JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString("utf8"));
    expect(decoded.t).toBe("telangana-police");
    expect(decoded.p).toBe("platform_pilot_operator");
  });
});
