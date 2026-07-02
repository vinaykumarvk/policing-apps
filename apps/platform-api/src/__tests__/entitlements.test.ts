import { describe, expect, it } from "vitest";
import claimFixtures from "../../../../docs/spec/auth-claim-fixtures.json";
import type { EntitlementRequest, PlatformClaims } from "../../../../packages/authz/src";
import { createPlatformApp } from "../app";

interface ClaimFixture {
  id: string;
  claim: PlatformClaims;
}

interface ClaimFixtureDocument {
  personas: ClaimFixture[];
}

interface EntitlementResponse {
  allowed: boolean;
  reason: string;
  detail: string;
  policy_version: string;
  decision_evidence: {
    decision_id: string;
    outcome: "allow" | "deny";
    reason: string;
    correlation_id: string;
  };
}

const NOW = "2026-07-01T18:45:00Z";
const typedClaimFixtures = claimFixtures as ClaimFixtureDocument;

function persona(id: string): PlatformClaims {
  const found = typedClaimFixtures.personas.find((entry) => entry.id === id);
  if (!found) {
    throw new Error(`missing persona ${id}`);
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

function entitlementRequest(
  claim: PlatformClaims | null,
  body: EntitlementRequest,
  verified: boolean,
  correlationId: string,
): Request {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-platform-claims-verified": verified ? "true" : "false",
    "x-correlation-id": correlationId,
  };
  if (claim) {
    headers["x-platform-claims"] = JSON.stringify(claim);
  }
  return new Request("http://platform.test/api/v1/platform/entitlements/check", {
    method: "POST",
    headers,
    body: JSON.stringify({ request: body }),
  });
}

describe("platform entitlement check route", () => {
  it("allows a matching server-verified entitlement request", async () => {
    const app = createPlatformApp({ now: () => new Date(NOW) });
    const response = await app.handle(
      entitlementRequest(persona("io"), dopamsCaseReadRequest(), true, "corr-p6-entitlement-allow"),
    );
    const body = (await response.json()) as EntitlementResponse;

    expect(response.status).toBe(200);
    expect(body.allowed).toBe(true);
    expect(body.reason).toBe("ALLOW");
    expect(body.policy_version).toBe("platform.entitlements.v1");
    expect(body.decision_evidence.outcome).toBe("allow");
    expect(app.decisionEvidence.all()).toHaveLength(1);
  });

  it("denies without trusting client-provided serverVerified when the server header is absent", async () => {
    const app = createPlatformApp({ now: () => new Date(NOW) });
    const response = await app.handle(
      entitlementRequest(
        persona("io"),
        dopamsCaseReadRequest({ serverVerified: true }),
        false,
        "corr-p6-entitlement-server-verify-deny",
      ),
    );
    const body = (await response.json()) as EntitlementResponse;
    const evidence = app.decisionEvidence.all()[0];

    expect(response.status).toBe(403);
    expect(body.allowed).toBe(false);
    expect(body.reason).toBe("SERVER_VERIFICATION_REQUIRED");
    expect(body.decision_evidence.outcome).toBe("deny");
    expect(evidence?.outcome).toBe("deny");
    expect(evidence?.reason).toBe("SERVER_VERIFICATION_REQUIRED");
    expect(evidence?.correlation_id).toBe("corr-p6-entitlement-server-verify-deny");
  });

  it("denies platform admins from operational DOPAMS access and emits decision evidence", async () => {
    const app = createPlatformApp({ now: () => new Date(NOW) });
    const response = await app.handle(
      entitlementRequest(persona("admin"), dopamsCaseReadRequest(), true, "corr-p6-entitlement-admin-deny"),
    );
    const body = (await response.json()) as EntitlementResponse;
    const evidence = app.decisionEvidence.all()[0];

    expect(response.status).toBe(403);
    expect(body.allowed).toBe(false);
    expect(body.reason).toBe("MODULE_DENIED");
    expect(body.decision_evidence.decision_id).toMatch(/^authzdec_/);
    expect(evidence?.outcome).toBe("deny");
    expect(evidence?.decision_inputs.claim_valid).toBe(true);
    expect(evidence?.resource.source_version).toBe("platform.app_registry.v1");
    expect(evidence?.redaction_decision.storage_uri_exposed).toBe(false);
  });
});
