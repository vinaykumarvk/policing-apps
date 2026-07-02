import { describe, expect, it } from "vitest";
import {
  PLATFORM_CASE_PROJECTION_SCHEMA_VERSION,
  CaseProjectionValidationError,
  type PlatformCaseProjection,
  createCaseRedactionDecision,
  toPlatformCaseReadModel,
  validatePlatformCaseProjection,
} from "../platform-case";

function platformCase(overrides: Partial<PlatformCaseProjection> = {}): PlatformCaseProjection {
  return {
    schema_version: PLATFORM_CASE_PROJECTION_SCHEMA_VERSION,
    case_id: "CASE-DOPAMS-001",
    source_system: "dopams",
    source_record_id: "dopams-case-001",
    case_number: "DOPAMS/2026/001",
    title: "Synthetic narcotics intelligence case",
    summary: "Synthetic summary for platform projection testing.",
    status: "open",
    jurisdiction: {
      country: "IN",
      state: "PB",
      district: "SAS Nagar",
      police_station: "Phase-8",
    },
    assigned_unit_id: "narcotics-cell-mohali",
    lead_investigator_id: "user-io-001",
    subject_identifiers: ["synthetic-subject-001"],
    legal_hold_status: "none",
    classification: "confidential",
    source_version: "dopams-case-v1",
    projection_version: "platform-case-v1",
    projected_at: "2026-07-01T18:44:30Z",
    source_status: "active",
    ...overrides,
  };
}

describe("platform case core contracts", () => {
  it("validates a complete canonical case projection", () => {
    const result = validatePlatformCaseProjection(platformCase());

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.projection.schema_version).toBe(PLATFORM_CASE_PROJECTION_SCHEMA_VERSION);
      expect(result.projection.source_version).toBe("dopams-case-v1");
      expect(result.projection.projection_version).toBe("platform-case-v1");
      expect(result.projection.classification).toBe("confidential");
    }
  });

  it("returns explicit validation errors for incomplete projections", () => {
    const result = validatePlatformCaseProjection({
      ...platformCase(),
      source_version: "",
      projection_version: "",
      projected_at: "not-a-date",
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("INVALID_TIMESTAMP");
      expect(result.issues).toContain("source_version must be a non-empty string");
      expect(result.issues).toContain("projection_version must be a non-empty string");
      expect(result.issues).toContain("projected_at must be an ISO timestamp");
    }
  });

  it("builds a summary read model with policy redactions applied", () => {
    const redaction = createCaseRedactionDecision("case-summary-v1");
    const readModel = toPlatformCaseReadModel(platformCase(), redaction);

    expect(readModel.case_id).toBe("CASE-DOPAMS-001");
    expect(readModel.title).toBe("Synthetic narcotics intelligence case");
    expect(readModel.lead_investigator_id).toBeNull();
    expect(readModel.subject_identifiers).toBeNull();
    expect(readModel.legal_hold_status).toBeNull();
    expect(readModel.redaction_decision.fields_redacted).toEqual([
      "lead_investigator_id",
      "subject_identifiers",
      "legal_hold_status",
    ]);
  });

  it("throws a typed error when callers build a read model from invalid input", () => {
    expect(() =>
      toPlatformCaseReadModel(
        {
          ...platformCase(),
          schema_version: "platform.case_projection.v99",
        },
        createCaseRedactionDecision("legal-review-v1"),
      ),
    ).toThrow(CaseProjectionValidationError);
  });

  it("uses deny-none to remove every platform case response field", () => {
    const readModel = toPlatformCaseReadModel(platformCase(), createCaseRedactionDecision("deny-none"));

    expect(readModel.case_id).toBeNull();
    expect(readModel.source_system).toBeNull();
    expect(readModel.summary).toBeNull();
    expect(readModel.projection_version).toBeNull();
    expect(readModel.redaction_decision.storage_uri_exposed).toBe(false);
  });
});
