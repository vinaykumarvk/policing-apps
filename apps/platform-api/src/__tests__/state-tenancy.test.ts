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
