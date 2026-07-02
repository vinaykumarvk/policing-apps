import { describe, expect, it } from "vitest";
import {
  AUTHORIZATION_DECISION_EVIDENCE_SCHEMA_VERSION,
  type AuthorizationDecisionEvidenceInput,
  DecisionEvidenceValidationError,
  createAuthorizationDecisionEvidence,
  recomputeAuthorizationDecisionHash,
  validateAuthorizationDecisionEvidenceInput,
} from "../decision-evidence";

function baseEvidenceInput(overrides: Partial<AuthorizationDecisionEvidenceInput> = {}): AuthorizationDecisionEvidenceInput {
  return {
    occurred_at: "2026-07-01T18:45:00Z",
    correlation_id: "corr-p3-evidence-001",
    outcome: "allow",
    reason: "ALLOW",
    detail: "allowed",
    policy_version: "platform.abac.v1",
    entitlement_policy_version: "platform.entitlements.v1",
    path: "/api/v1/platform/evidence/EVID-DOPAMS-001",
    action: "platform.evidence.read",
    claims_snapshot: {
      validation: "valid",
      schema_version: "platform.claims.v1",
      claim_version: 1,
      source_version: "idp-seed-v1",
      subject_id: "user-io-001",
      persona: "io",
      session_id: "sess-io-001",
      modules: ["dopams", "iqw"],
      mfa_verified: true,
      expires_at: "2026-07-01T19:30:00Z",
    },
    resource: {
      kind: "platform_evidence",
      resource_id: "EVID-DOPAMS-001",
      source_system: "dopams",
      source_record_id: "EVID-DOPAMS-001",
      source_version: "dopams-evidence-v1",
      projection_version: "platform-evidence-v1",
      source_status: "active",
      classification: "confidential",
      legal_hold_status: "none",
    },
    redaction_decision: {
      profile: "evidence-metadata-v1",
      fields_redacted: ["storage_uri"],
      storage_uri_exposed: false,
      reason: "central_metadata_only",
    },
    decision_inputs: {
      server_verified: true,
      claim_valid: true,
      policy_present: true,
      resource_complete: true,
      projection_fresh: true,
      source_active: true,
      redaction_complete: true,
      storage_uri_exposed: false,
      legal_hold_checked: true,
      jurisdiction_checked: true,
      assignment_checked: true,
      clearance_checked: true,
      purpose_checked: true,
      mfa_checked: true,
    },
    ...overrides,
  };
}

describe("authorization decision evidence", () => {
  it("creates immutable evidence with every required field and a stable hash", () => {
    const evidence = createAuthorizationDecisionEvidence(baseEvidenceInput());

    expect(evidence.evidence_schema_version).toBe(AUTHORIZATION_DECISION_EVIDENCE_SCHEMA_VERSION);
    expect(evidence.decision_id).toMatch(/^authzdec_/);
    expect(evidence.occurred_at).toBe("2026-07-01T18:45:00Z");
    expect(evidence.correlation_id).toBe("corr-p3-evidence-001");
    expect(evidence.outcome).toBe("allow");
    expect(evidence.reason).toBe("ALLOW");
    expect(evidence.policy_version).toBe("platform.abac.v1");
    expect(evidence.entitlement_policy_version).toBe("platform.entitlements.v1");
    expect(evidence.path).toBe("/api/v1/platform/evidence/EVID-DOPAMS-001");
    expect(evidence.action).toBe("platform.evidence.read");
    expect(evidence.claims_snapshot).toMatchObject({ subject_id: "user-io-001", validation: "valid" });
    expect(evidence.resource.source_version).toBe("dopams-evidence-v1");
    expect(evidence.resource.projection_version).toBe("platform-evidence-v1");
    expect(evidence.redaction_decision.storage_uri_exposed).toBe(false);
    expect(evidence.redaction_decision.fields_redacted).toContain("storage_uri");
    expect(evidence.decision_inputs.server_verified).toBe(true);
    expect(evidence.decision_inputs.claim_valid).toBe(true);
    expect(evidence.decision_inputs.projection_fresh).toBe(true);
    expect(evidence.integrity.algorithm).toBe("sha256");
    expect(evidence.integrity.payload_hash).toHaveLength(64);
    expect(recomputeAuthorizationDecisionHash(evidence)).toBe(evidence.integrity.payload_hash);
    expect(Object.isFrozen(evidence)).toBe(true);
    expect(Object.isFrozen(evidence.resource)).toBe(true);
    expect(Object.isFrozen(evidence.redaction_decision.fields_redacted)).toBe(true);
  });

  it("records deny evidence for invalid claims and missing source/projection markers", () => {
    const evidence = createAuthorizationDecisionEvidence(
      baseEvidenceInput({
        outcome: "deny",
        reason: "RESOURCE_INCOMPLETE",
        detail: "source_version is required",
        claims_snapshot: {
          validation: "invalid",
          validation_reason: "CLAIM_MISSING",
          validation_issues: ["claim must be an object"],
          schema_version: null,
          claim_version: null,
          source_version: null,
          subject_id: null,
          persona: null,
          session_id: null,
          modules: [],
          domain_permissions: [],
          mfa_verified: null,
          expires_at: null,
        },
        resource: {
          ...baseEvidenceInput().resource,
          source_version: "missing",
          projection_version: "missing",
        },
        decision_inputs: {
          ...baseEvidenceInput().decision_inputs,
          claim_valid: false,
          resource_complete: false,
          projection_fresh: false,
        },
      }),
    );

    expect(evidence.outcome).toBe("deny");
    expect(evidence.claims_snapshot).toMatchObject({ validation: "invalid" });
    expect(evidence.resource.source_version).toBe("missing");
    expect(evidence.resource.projection_version).toBe("missing");
  });

  it("validates optional retrieval evidence without enabling retrieval by default", () => {
    const result = validateAuthorizationDecisionEvidenceInput(
      baseEvidenceInput({
        outcome: "deny",
        reason: "KNOWLEDGE_RETRIEVAL_DISABLED",
        path: "/api/v1/platform/knowledge/query",
        action: "platform.knowledge.retrieve",
        resource: {
          ...baseEvidenceInput().resource,
          kind: "knowledge_citation",
          resource_id: "citation-001",
        },
        retrieval: {
          retrieval_path: "pre_retrieval_filter",
          candidate_source_ids: ["CASE-DOPAMS-001"],
          citation_ids: ["citation-001"],
        },
        decision_inputs: {
          ...baseEvidenceInput().decision_inputs,
          projection_fresh: false,
        },
      }),
    );

    expect(result.valid).toBe(true);
  });

  it("rejects evidence missing mandatory decision fields", () => {
    expect(() =>
      createAuthorizationDecisionEvidence(
        baseEvidenceInput({
          correlation_id: "",
          policy_version: "",
          path: "",
        }),
      ),
    ).toThrow(DecisionEvidenceValidationError);
  });

  it("rejects allow evidence when required authorization checks are incomplete", () => {
    expect(() =>
      createAuthorizationDecisionEvidence(
        baseEvidenceInput({
          decision_inputs: {
            ...baseEvidenceInput().decision_inputs,
            projection_fresh: false,
          },
        }),
      ),
    ).toThrow(DecisionEvidenceValidationError);
  });

  it("rejects platform evidence entries that expose storage_uri by default", () => {
    expect(() =>
      createAuthorizationDecisionEvidence(
        baseEvidenceInput({
          redaction_decision: {
            profile: "unsafe",
            fields_redacted: [],
            storage_uri_exposed: true,
            reason: "unsafe_storage_location",
          },
        }),
      ),
    ).toThrow(DecisionEvidenceValidationError);
  });
});
