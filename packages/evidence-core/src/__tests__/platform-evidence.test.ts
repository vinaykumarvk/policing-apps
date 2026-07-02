import { describe, expect, it } from "vitest";
import {
  PLATFORM_EVIDENCE_PROJECTION_SCHEMA_VERSION,
  EvidenceProjectionValidationError,
  type EvidenceRedactionDecision,
  type PlatformEvidenceProjection,
  createEvidenceRedactionDecision,
  toPlatformEvidenceReadModel,
  validateEvidenceRedactionDecision,
  validatePlatformEvidenceProjection,
} from "../platform-evidence";

function platformEvidence(overrides: Partial<PlatformEvidenceProjection> = {}): PlatformEvidenceProjection {
  return {
    schema_version: PLATFORM_EVIDENCE_PROJECTION_SCHEMA_VERSION,
    evidence_id: "EVID-DOPAMS-001",
    case_id: "CASE-DOPAMS-001",
    source_system: "dopams",
    source_record_id: "dopams-evidence-001",
    display_name: "Synthetic seizure photo",
    mime_type: "image/jpeg",
    size_bytes: 1048576,
    hash_sha256: "0f4c2f4f0f4c2f4f0f4c2f4f0f4c2f4f0f4c2f4f0f4c2f4f0f4c2f4f0f4c2f4f",
    chain_of_custody_head: "custody-entry-001",
    classification: "confidential",
    legal_hold_status: "none",
    retention_status: "active",
    source_version: "dopams-evidence-v1",
    projection_version: "platform-evidence-v1",
    projected_at: "2026-07-01T18:44:30Z",
    source_status: "active",
    storage_uri: "s3://synthetic-evidence/EVID-DOPAMS-001",
    ...overrides,
  };
}

describe("platform evidence core contracts", () => {
  it("validates a complete canonical evidence projection", () => {
    const result = validatePlatformEvidenceProjection(platformEvidence());

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.projection.schema_version).toBe(PLATFORM_EVIDENCE_PROJECTION_SCHEMA_VERSION);
      expect(result.projection.source_version).toBe("dopams-evidence-v1");
      expect(result.projection.projection_version).toBe("platform-evidence-v1");
      expect(result.projection.storage_uri).toBe("s3://synthetic-evidence/EVID-DOPAMS-001");
    }
  });

  it("returns explicit validation errors for incomplete evidence projections", () => {
    const result = validatePlatformEvidenceProjection({
      ...platformEvidence(),
      source_version: "",
      projection_version: "",
      size_bytes: -1,
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("INVALID_SIZE");
      expect(result.issues).toContain("source_version must be a non-empty string");
      expect(result.issues).toContain("projection_version must be a non-empty string");
      expect(result.issues).toContain("size_bytes must be a non-negative integer");
    }
  });

  it("builds metadata read models without exposing storage_uri", () => {
    const readModel = toPlatformEvidenceReadModel(
      platformEvidence(),
      createEvidenceRedactionDecision("evidence-metadata-v1"),
    );

    expect(readModel.evidence_id).toBe("EVID-DOPAMS-001");
    expect(readModel.display_name).toBe("Synthetic seizure photo");
    expect(readModel.hash_sha256).toBeNull();
    expect(readModel.chain_of_custody_head).toBeNull();
    expect(readModel.legal_hold_status).toBeNull();
    expect("storage_uri" in readModel).toBe(false);
    expect(readModel.redaction_decision.storage_uri_exposed).toBe(false);
    expect(readModel.redaction_decision.fields_redacted).toContain("storage_uri");
  });

  it("rejects redaction decisions that try to expose storage_uri", () => {
    const unsafeDecision: EvidenceRedactionDecision = {
      profile: "legal-review-v1",
      fields_redacted: [],
      storage_uri_exposed: false,
      reason: "legal_review",
    };

    const result = validateEvidenceRedactionDecision(unsafeDecision);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("INVALID_REDACTION_DECISION");
      expect(result.issues).toContain("storage_uri must always be redacted from platform evidence responses");
    }
  });

  it("throws a typed error when callers build a read model from invalid input", () => {
    expect(() =>
      toPlatformEvidenceReadModel(
        {
          ...platformEvidence(),
          schema_version: "platform.evidence_projection.v99",
        },
        createEvidenceRedactionDecision("legal-review-v1"),
      ),
    ).toThrow(EvidenceProjectionValidationError);
  });

  it("uses deny-none to remove every platform evidence response field", () => {
    const readModel = toPlatformEvidenceReadModel(platformEvidence(), createEvidenceRedactionDecision("deny-none"));

    expect(readModel.evidence_id).toBeNull();
    expect(readModel.case_id).toBeNull();
    expect(readModel.display_name).toBeNull();
    expect(readModel.projection_version).toBeNull();
    expect(readModel.redaction_decision.storage_uri_exposed).toBe(false);
  });
});
