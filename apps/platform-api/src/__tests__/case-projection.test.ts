import { describe, expect, it } from "vitest";
import claimFixtures from "../../../../docs/spec/auth-claim-fixtures.json";
import type { PlatformClaims } from "../../../../packages/authz/src";
import {
  createCaseProjectionService,
  recordsFromFixture,
  type CaseProjectionReadInput,
  type PlatformCaseProjectionRecord,
} from "../services/case-projection";

interface ClaimFixture {
  id: string;
  claim: PlatformClaims;
}

interface ClaimFixtureDocument {
  personas: ClaimFixture[];
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

function readInput(claim: PlatformClaims = persona("supervisor")): CaseProjectionReadInput {
  return {
    claimInput: claim,
    serverVerified: true,
    correlationId: "corr-p9-case-projection",
    now: NOW,
    expectedSourceVersion: "idp-seed-v1",
    projectionMaxAgeSeconds: 300,
    purpose: "case_review",
  };
}

function withRecord(
  caseId: string,
  update: (record: PlatformCaseProjectionRecord) => PlatformCaseProjectionRecord,
): PlatformCaseProjectionRecord[] {
  return recordsFromFixture().map((record) => (record.projection.case_id === caseId ? update(record) : record));
}

describe("P9 case projection service", () => {
  it("loads the pilot DOPAMS plus IQW linked case projections from source-authoritative fixtures", () => {
    const service = createCaseProjectionService();
    const dopams = service.getCase("CASE-DOPAMS-001");
    const linked = service.listLinkedCases("CASE-DOPAMS-001");

    expect(dopams?.projection.source_system).toBe("dopams");
    expect(dopams?.projection.source_version).toBe("dopams-case-v1");
    expect(dopams?.projection.projection_version).toBe("platform-case-v1");
    expect(dopams?.source_authoritative).toBe(true);
    expect(linked.map((record) => record.projection.case_id)).toEqual(["CASE-IQW-001"]);
  });

  it("allows a supervisor to read the linked IQW projection with fixture redaction applied", () => {
    const service = createCaseProjectionService();
    const result = service.readCase("CASE-IQW-001", readInput());

    expect(result.status).toBe("allowed");
    if (result.status !== "allowed") {
      throw new Error("expected IQW case projection read to allow");
    }
    expect(result.read_model.case_id).toBe("CASE-IQW-001");
    expect(result.read_model.title).toBeNull();
    expect(result.read_model.summary).toBeNull();
    expect(result.read_model.redaction_decision.storage_uri_exposed).toBe(false);
    expect(result.decision.decision_evidence.resource.source_version).toBe("iqw-case-v1");
    expect(result.decision.decision_evidence.resource.projection_version).toBe("platform-case-v1");
  });

  it("denies stale case projections before returning source data", () => {
    const service = createCaseProjectionService({
      records: withRecord("CASE-DOPAMS-001", (record) => ({
        ...record,
        projection: {
          ...record.projection,
          projected_at: "2026-07-01T18:30:00Z",
        },
      })),
    });
    const result = service.readCase("CASE-DOPAMS-001", readInput());

    expect(result.status).toBe("denied");
    if (result.status === "allowed") {
      throw new Error("stale projection should not be allowed");
    }
    expect(result.decision.reason).toBe("STALE_PROJECTION");
    expect(result.decision.decision_evidence.decision_inputs.projection_fresh).toBe(false);
  });

  it("denies deleted and retention-inaccessible case records deterministically", () => {
    const deletedService = createCaseProjectionService({
      records: withRecord("CASE-DOPAMS-001", (record) => ({
        ...record,
        projection: {
          ...record.projection,
          source_status: "deleted",
        },
      })),
    });
    const deleted = deletedService.readCase("CASE-DOPAMS-001", readInput());

    expect(deleted.status).toBe("denied");
    if (deleted.status === "allowed") {
      throw new Error("deleted projection should not be allowed");
    }
    expect(deleted.decision.reason).toBe("SOURCE_STATUS_DENIED");
    expect(deleted.decision.decision_evidence.resource.source_status).toBe("deleted");

    const retainedService = createCaseProjectionService({
      records: withRecord("CASE-DOPAMS-001", (record) => ({
        ...record,
        retention_status: "retained_inaccessible",
      })),
    });
    const retained = retainedService.readCase("CASE-DOPAMS-001", readInput());

    expect(retained.status).toBe("denied");
    if (retained.status === "allowed") {
      throw new Error("retention-inaccessible projection should not be allowed");
    }
    expect(retained.decision.reason).toBe("SOURCE_STATUS_DENIED");
    expect(retained.decision.decision_evidence.resource.source_status).toBe("retained_inaccessible");
  });

  it("records missing projections as deny decision evidence without returning case fields", () => {
    const service = createCaseProjectionService();
    const result = service.readCase("CASE-MISSING-001", readInput());

    expect(result.status).toBe("missing");
    if (result.status === "allowed") {
      throw new Error("missing projection should not be allowed");
    }
    expect(result.decision.reason).toBe("RESOURCE_INCOMPLETE");
    expect(result.decision.decision_evidence.resource.resource_id).toBe("CASE-MISSING-001");
    expect(result.decision.decision_evidence.resource.source_version).toBe("missing");
    expect(result.decision.decision_evidence.redaction_decision.profile).toBe("deny-none");
  });
});
