import { describe, expect, it } from "vitest";
import fixtures from "../../../../docs/spec/auth-claim-fixtures.json";
import type { PlatformClaims } from "../claims";
import { type EntitlementRequest, evaluateEntitlement } from "../entitlements";

interface ClaimFixture {
  id: string;
  claim: PlatformClaims;
}

interface AuthClaimFixtures {
  personas: ClaimFixture[];
}

const NOW = "2026-07-01T18:45:00Z";
const typedFixtures = fixtures as AuthClaimFixtures;

function persona(id: string): PlatformClaims {
  const found = typedFixtures.personas.find((entry) => entry.id === id);
  if (!found) {
    throw new Error(`missing fixture persona ${id}`);
  }
  return found.claim;
}

function dopamsCaseReadRequest(overrides: Partial<EntitlementRequest> = {}): EntitlementRequest {
  return {
    module: "dopams",
    domain: "dopams",
    permission: "case:read",
    org_id: "mohali-district",
    unit_id: "narcotics-cell-mohali",
    jurisdiction: {
      country: "IN",
      state: "PB",
      district: "SAS Nagar",
      police_station: "Phase-8",
    },
    requiredClearance: "confidential",
    assignment: { case_id: "CASE-DOPAMS-001" },
    purpose: "investigation",
    requireMfa: true,
    serverVerified: true,
    ...overrides,
  };
}

describe("platform entitlement evaluation", () => {
  it("allows a fully matching server-verified IO claim", () => {
    const decision = evaluateEntitlement(persona("io"), dopamsCaseReadRequest(), {
      now: NOW,
      expectedSourceVersion: "idp-seed-v1",
    });

    expect(decision.allowed).toBe(true);
    if (decision.allowed) {
      expect(decision.policy_version).toBe("platform.entitlements.v1");
      expect(decision.claims_snapshot.subject_id).toBe("user-io-001");
    }
  });

  it("denies when server-side verification is missing even if dimensions match", () => {
    const decision = evaluateEntitlement(
      persona("io"),
      dopamsCaseReadRequest({ serverVerified: false }),
      { now: NOW },
    );

    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.reason).toBe("SERVER_VERIFICATION_REQUIRED");
    }
  });

  it("denies missing, stale, or incompatible claims by default", () => {
    const missingDecision = evaluateEntitlement(undefined, dopamsCaseReadRequest(), { now: NOW });
    expect(missingDecision.allowed).toBe(false);
    if (!missingDecision.allowed) {
      expect(missingDecision.reason).toBe("CLAIMS_DENIED");
    }

    const staleDecision = evaluateEntitlement(persona("io"), dopamsCaseReadRequest(), {
      now: "2026-07-01T19:00:01Z",
      maxAgeSeconds: 60,
    });
    expect(staleDecision.allowed).toBe(false);
    if (!staleDecision.allowed) {
      expect(staleDecision.reason).toBe("CLAIMS_DENIED");
      expect(staleDecision.detail).toBe("CLAIM_STALE");
    }

    const incompatibleDecision = evaluateEntitlement(persona("io"), dopamsCaseReadRequest(), {
      now: NOW,
      expectedSourceVersion: "idp-seed-v2",
    });
    expect(incompatibleDecision.allowed).toBe(false);
    if (!incompatibleDecision.allowed) {
      expect(incompatibleDecision.detail).toBe("CLAIM_INCOMPATIBLE_SOURCE");
    }
  });

  it("denies wrong module, jurisdiction, clearance, assignment, purpose, and MFA", () => {
    expect(evaluateEntitlement(persona("desk-operator"), dopamsCaseReadRequest(), { now: NOW }).allowed).toBe(false);
    expect(
      evaluateEntitlement(
        persona("io"),
        dopamsCaseReadRequest({ jurisdiction: { country: "IN", state: "PB", district: "Ludhiana" } }),
        { now: NOW },
      ).allowed,
    ).toBe(false);
    expect(
      evaluateEntitlement(persona("desk-operator"), dopamsCaseReadRequest({ requiredClearance: "secret" }), {
        now: NOW,
      }).allowed,
    ).toBe(false);
    expect(
      evaluateEntitlement(persona("io"), dopamsCaseReadRequest({ assignment: { case_id: "CASE-DOPAMS-999" } }), {
        now: NOW,
      }).allowed,
    ).toBe(false);
    expect(evaluateEntitlement(persona("io"), dopamsCaseReadRequest({ purpose: "audit" }), { now: NOW }).allowed).toBe(
      false,
    );

    const noMfa = JSON.parse(JSON.stringify(persona("io"))) as PlatformClaims;
    noMfa.mfa = { required: true, verified: false, methods: [], verified_at: null };
    const mfaDecision = evaluateEntitlement(noMfa, dopamsCaseReadRequest(), { now: NOW });
    expect(mfaDecision.allowed).toBe(false);
    if (!mfaDecision.allowed) {
      expect(mfaDecision.reason).toBe("MFA_DENIED");
    }
  });

  it("does not treat platform admin as operational case access", () => {
    const decision = evaluateEntitlement(persona("admin"), dopamsCaseReadRequest(), { now: NOW });

    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.reason).toBe("MODULE_DENIED");
    }
  });

  it("allows platform audit reads only for audit purpose and explicit permission", () => {
    const decision = evaluateEntitlement(
      persona("auditor"),
      {
        module: "platform_admin",
        domain: "platform",
        permission: "decision_evidence:read",
        org_id: "audit-cell",
        unit_id: "audit-review",
        jurisdiction: { country: "IN", state: "PB" },
        requiredClearance: "confidential",
        assignment: { queue_id: "audit-review" },
        purpose: "audit",
        requireMfa: true,
        serverVerified: true,
      },
      { now: NOW },
    );

    expect(decision.allowed).toBe(true);
  });
});
