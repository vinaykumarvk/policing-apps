import { describe, expect, it } from "vitest";
import fixtures from "../../../../docs/spec/auth-claim-fixtures.json";
import type { PlatformClaims } from "../claims";
import {
  type AbacRequest,
  type AbacResourceContext,
  type RedactionDecision,
  evaluateAbac,
} from "../abac";

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

function evidenceReadRequest(
  overrides: Partial<AbacRequest> = {},
  resourceOverrides: Partial<AbacResourceContext> = {},
  redactionOverrides: Partial<RedactionDecision> = {},
): AbacRequest {
  const redaction: RedactionDecision = {
    profile: "evidence-metadata-v1",
    fields_redacted: ["storage_uri"],
    storage_uri_exposed: false,
    reason: "central_metadata_only",
    ...redactionOverrides,
  };

  return {
    action: "platform.evidence.read",
    path: "/api/v1/platform/evidence/EVID-DOPAMS-001",
    correlation_id: "corr-p3-evidence-001",
    module: "dopams",
    domain: "dopams",
    permission: "evidence:metadata-read",
    purpose: "investigation",
    require_mfa: true,
    server_verified: true,
    resource: {
      kind: "platform_evidence",
      resource_id: "EVID-DOPAMS-001",
      source_system: "dopams",
      source_record_id: "EVID-DOPAMS-001",
      source_version: "dopams-evidence-v1",
      projection_version: "platform-evidence-v1",
      projected_at: "2026-07-01T18:44:30Z",
      source_status: "active",
      classification: "confidential",
      org_id: "mohali-district",
      unit_id: "narcotics-cell-mohali",
      jurisdiction: {
        country: "IN",
        state: "PB",
        district: "SAS Nagar",
        police_station: "Phase-8",
      },
      assignment: {
        case_id: "CASE-DOPAMS-001",
        evidence_id: "EVID-DOPAMS-001",
      },
      legal_hold_status: "none",
      ...resourceOverrides,
    },
    redaction_decision: redaction,
    ...overrides,
  };
}

function caseReadRequest(resourceOverrides: Partial<AbacResourceContext> = {}): AbacRequest {
  return {
    ...evidenceReadRequest(
      {
        action: "platform.case.read",
        path: "/api/v1/platform/cases/CASE-DOPAMS-001",
        correlation_id: "corr-p3-case-001",
        permission: "case:read",
      },
      {
        kind: "platform_case",
        resource_id: "CASE-DOPAMS-001",
        source_record_id: "CASE-DOPAMS-001",
        source_version: "dopams-case-v1",
        projection_version: "platform-case-v1",
        legal_hold_status: "none",
        ...resourceOverrides,
      },
    ),
    redaction_decision: {
      profile: "case-summary-v1",
      fields_redacted: ["subject_identifiers"],
      storage_uri_exposed: false,
      reason: "case_summary",
    },
  };
}

describe("platform ABAC deny-by-default policy", () => {
  it("allows a complete pilot evidence read and emits evidence-ready fields", () => {
    const decision = evaluateAbac(persona("io"), evidenceReadRequest(), { now: NOW });

    expect(decision.allowed).toBe(true);
    expect(decision.decision_evidence.outcome).toBe("allow");
    expect(decision.decision_evidence.claims_snapshot.validation).toBe("valid");
    expect(decision.decision_evidence.policy_version).toBe("platform.abac.v1");
    expect(decision.decision_evidence.entitlement_policy_version).toBe("platform.entitlements.v1");
    expect(decision.decision_evidence.resource.source_version).toBe("dopams-evidence-v1");
    expect(decision.decision_evidence.resource.projection_version).toBe("platform-evidence-v1");
    expect(decision.decision_evidence.redaction_decision.storage_uri_exposed).toBe(false);
    expect(decision.decision_evidence.path).toBe("/api/v1/platform/evidence/EVID-DOPAMS-001");
    expect(decision.decision_evidence.correlation_id).toBe("corr-p3-evidence-001");
  });

  it("denies when policy version is missing", () => {
    const decision = evaluateAbac(persona("io"), evidenceReadRequest(), { now: NOW, policyVersion: "" });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("POLICY_MISSING");
    expect(decision.decision_evidence.policy_version).toBe("missing");
    expect(decision.decision_evidence.decision_inputs.policy_present).toBe(false);
  });

  it("denies missing source/projection inputs but still records the missing markers", () => {
    const decision = evaluateAbac(
      persona("io"),
      evidenceReadRequest({}, { source_version: null, projection_version: null }),
      { now: NOW },
    );

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("RESOURCE_INCOMPLETE");
    expect(decision.decision_evidence.resource.source_version).toBe("missing");
    expect(decision.decision_evidence.resource.projection_version).toBe("missing");
    expect(decision.decision_evidence.decision_inputs.resource_complete).toBe(false);
  });

  it("denies stale projections before returning pilot case data", () => {
    const decision = evaluateAbac(
      persona("io"),
      caseReadRequest({ projected_at: "2026-07-01T18:30:00Z" }),
      { now: NOW, projectionMaxAgeSeconds: 300 },
    );

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("STALE_PROJECTION");
    expect(decision.decision_evidence.resource.source_version).toBe("dopams-case-v1");
    expect(decision.decision_evidence.resource.projection_version).toBe("platform-case-v1");
    expect(decision.decision_evidence.decision_inputs.projection_fresh).toBe(false);
  });

  it("denies deleted, sealed, or otherwise inactive source records", () => {
    const decision = evaluateAbac(
      persona("io"),
      evidenceReadRequest({}, { source_status: "deleted" }),
      { now: NOW },
    );

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("SOURCE_STATUS_DENIED");
    expect(decision.decision_evidence.decision_inputs.source_active).toBe(false);
  });

  it("denies ordinary investigation reads when legal hold is active", () => {
    const decision = evaluateAbac(
      persona("io"),
      evidenceReadRequest({}, { legal_hold_status: "active" }),
      { now: NOW },
    );

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("LEGAL_HOLD_DENIED");
    expect(decision.decision_evidence.resource.legal_hold_status).toBe("active");
    expect(decision.decision_evidence.decision_inputs.legal_hold_checked).toBe(true);
  });

  it("denies jurisdiction conflicts through server-side entitlement checks", () => {
    const decision = evaluateAbac(
      persona("io"),
      caseReadRequest({ jurisdiction: { country: "IN", state: "PB", district: "Ludhiana" } }),
      { now: NOW },
    );

    expect(decision.allowed).toBe(false);
    if (decision.allowed) {
      throw new Error("jurisdiction conflict should deny");
    }
    expect(decision.reason).toBe("ENTITLEMENT_DENIED");
    expect(decision.detail).toBe("JURISDICTION_DENIED");
    expect(decision.decision_evidence.claims_snapshot.validation).toBe("valid");
  });

  it("denies central evidence responses that try to expose storage_uri", () => {
    const decision = evaluateAbac(
      persona("io"),
      evidenceReadRequest({}, {}, { storage_uri_exposed: true, fields_redacted: [] }),
      { now: NOW },
    );

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("STORAGE_URI_DENIED");
    expect(decision.decision_evidence.redaction_decision.storage_uri_exposed).toBe(false);
    expect(decision.decision_evidence.redaction_decision.fields_redacted).toContain("storage_uri");
  });

  it("denies missing claims and records a deny snapshot", () => {
    const decision = evaluateAbac(undefined, evidenceReadRequest(), { now: NOW });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("ENTITLEMENT_DENIED");
    expect(decision.decision_evidence.claims_snapshot.validation).toBe("invalid");
    expect(decision.decision_evidence.decision_inputs.claim_valid).toBe(false);
  });

  it("denies app launch and knowledge retrieval while P3 routes remain inactive", () => {
    const launchDecision = evaluateAbac(
      persona("io"),
      evidenceReadRequest(
        {
          action: "platform.app.launch",
          path: "/api/v1/platform/apps/dopams/launch",
          correlation_id: "corr-p3-launch-001",
        },
        { kind: "app_route", resource_id: "dopams-app-route" },
      ),
      { now: NOW },
    );
    expect(launchDecision.allowed).toBe(false);
    expect(launchDecision.reason).toBe("APP_ROUTE_INACTIVE");

    const retrievalDecision = evaluateAbac(
      persona("io"),
      evidenceReadRequest(
        {
          action: "platform.knowledge.retrieve",
          path: "/api/v1/platform/knowledge/query",
          correlation_id: "corr-p3-knowledge-001",
          permission: "case:read",
        },
        { kind: "knowledge_citation", resource_id: "citation-001" },
      ),
      { now: NOW },
    );
    expect(retrievalDecision.allowed).toBe(false);
    expect(retrievalDecision.reason).toBe("KNOWLEDGE_RETRIEVAL_DISABLED");
  });
});
