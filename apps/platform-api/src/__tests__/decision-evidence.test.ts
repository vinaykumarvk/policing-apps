import { describe, expect, it } from "vitest";
import claimFixtures from "../../../../docs/spec/auth-claim-fixtures.json";
import type { EntitlementRequest, PlatformClaims } from "../../../../packages/authz/src";
import { recomputeAuthorizationDecisionHash } from "../../../../packages/audit-ledger/src";
import { createPlatformApp } from "../app";

interface ClaimFixture {
  id: string;
  claim: PlatformClaims;
}

interface ClaimFixtureDocument {
  personas: ClaimFixture[];
}

interface ClaimSnapshot {
  validation?: string;
  validation_reason?: string;
  validation_issues?: string[];
  subject_id?: string | null;
}

interface EntitlementResponse {
  allowed: boolean;
  reason: string;
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

function dopamsCaseReadRequest(): EntitlementRequest {
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
  };
}

function entitlementCheckRequest(
  claim: PlatformClaims | null,
  correlationId: string,
  verified = true,
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
    body: JSON.stringify({ request: dopamsCaseReadRequest() }),
  });
}

describe("platform authorization decision evidence", () => {
  it("emits immutable deny decision evidence when entitlement claims are missing", async () => {
    const app = createPlatformApp({ now: () => new Date(NOW) });
    const response = await app.handle(entitlementCheckRequest(null, "corr-p6-missing-claims-denied"));
    const body = (await response.json()) as EntitlementResponse;
    const evidence = app.decisionEvidence.all()[0];
    const snapshot = evidence?.claims_snapshot as ClaimSnapshot | undefined;

    expect(response.status).toBe(403);
    expect(body.allowed).toBe(false);
    expect(body.reason).toBe("CLAIMS_DENIED");
    expect(body.decision_evidence.outcome).toBe("deny");
    expect(evidence).toBeDefined();
    expect(evidence?.evidence_schema_version).toBe("platform.authorization_decision_evidence.v1");
    expect(evidence?.outcome).toBe("deny");
    expect(evidence?.reason).toBe("CLAIMS_DENIED");
    expect(evidence?.path).toBe("/api/v1/platform/entitlements/check");
    expect(evidence?.action).toBe("platform.entitlements.check");
    expect(evidence?.correlation_id).toBe("corr-p6-missing-claims-denied");
    expect(snapshot?.validation).toBe("invalid");
    expect(snapshot?.validation_issues).toContain("CLAIM_MISSING");
    expect(evidence?.resource.source_version).toBe("platform.app_registry.v1");
    expect(evidence?.resource.projection_version).toBe("platform.app_registry.v1");
    expect(evidence?.redaction_decision.storage_uri_exposed).toBe(false);
    expect(evidence?.decision_inputs.claim_valid).toBe(false);
    expect(evidence ? recomputeAuthorizationDecisionHash(evidence) : "").toBe(evidence?.integrity.payload_hash);
    expect(evidence ? Object.isFrozen(evidence) : false).toBe(true);
  });

  it("records deny evidence for valid claims that fail module entitlement", async () => {
    const app = createPlatformApp({ now: () => new Date(NOW) });
    const response = await app.handle(entitlementCheckRequest(persona("admin"), "corr-p6-admin-denied"));
    const body = (await response.json()) as EntitlementResponse;
    const evidence = app.decisionEvidence.all()[0];
    const snapshot = evidence?.claims_snapshot as ClaimSnapshot | undefined;

    expect(response.status).toBe(403);
    expect(body.reason).toBe("MODULE_DENIED");
    expect(evidence?.outcome).toBe("deny");
    expect(evidence?.reason).toBe("MODULE_DENIED");
    expect(snapshot?.validation).toBe("valid");
    expect(snapshot?.subject_id).toBe("user-admin-001");
    expect(evidence?.decision_inputs.server_verified).toBe(true);
    expect(evidence?.decision_inputs.claim_valid).toBe(true);
  });
});
