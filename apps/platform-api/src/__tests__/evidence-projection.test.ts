import { describe, expect, it } from "vitest";
import claimFixtures from "../../../../docs/spec/auth-claim-fixtures.json";
import type { PlatformClaims } from "../../../../packages/authz/src";
import {
  createEvidenceProjectionService,
  recordsFromFixture,
  type EvidenceProjectionReadInput,
  type PlatformEvidenceProjectionRecord,
} from "../services/evidence-projection";

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

function readInput(claim: PlatformClaims, purpose: string): EvidenceProjectionReadInput {
  return {
    claimInput: claim,
    serverVerified: true,
    correlationId: `corr-p9-evidence-${purpose}`,
    now: NOW,
    expectedSourceVersion: "idp-seed-v1",
    projectionMaxAgeSeconds: 300,
    purpose,
  };
}

function withRecord(
  evidenceId: string,
  update: (record: PlatformEvidenceProjectionRecord) => PlatformEvidenceProjectionRecord,
): PlatformEvidenceProjectionRecord[] {
  return recordsFromFixture().map((record) => (record.projection.evidence_id === evidenceId ? update(record) : record));
}

describe("P9 evidence projection service", () => {
  it("loads central evidence metadata without a raw storage_uri projection field", () => {
    const service = createEvidenceProjectionService();
    const evidence = service.getEvidence("EVID-DOPAMS-001");

    expect(evidence?.projection.source_version).toBe("dopams-evidence-v1");
    expect(evidence?.projection.projection_version).toBe("platform-evidence-v1");
    expect(evidence?.projection.retention_status).toBe("hold");
    expect(evidence?.storage_uri_present).toBe(false);
    expect(evidence?.storage_reference).toBe("platform-evidence-ref:EVID-DOPAMS-001");
  });

  it("denies ordinary investigation reads while legal hold is active", () => {
    const service = createEvidenceProjectionService();
    const result = service.readEvidence("EVID-DOPAMS-001", readInput(persona("io"), "investigation"));

    expect(result.status).toBe("denied");
    if (result.status === "allowed") {
      throw new Error("active legal hold evidence should deny investigation reads");
    }
    expect(result.decision.reason).toBe("LEGAL_HOLD_DENIED");
    expect(result.decision.decision_evidence.resource.legal_hold_status).toBe("active");
    expect(result.decision.decision_evidence.redaction_decision.storage_uri_exposed).toBe(false);
  });

  it("allows legal review metadata while still excluding storage_uri by default", () => {
    const service = createEvidenceProjectionService({
      records: withRecord("EVID-DOPAMS-001", (record) => ({
        ...record,
        projection: {
          ...record.projection,
          storage_uri: "s3://synthetic-evidence/EVID-DOPAMS-001",
        },
      })),
    });
    const result = service.readEvidence("EVID-DOPAMS-001", readInput(persona("legal-reviewer"), "legal_review"));

    expect(result.status).toBe("allowed");
    if (result.status !== "allowed") {
      throw new Error("legal review evidence read should allow");
    }
    expect(result.read_model.evidence_id).toBe("EVID-DOPAMS-001");
    expect(result.read_model.hash_sha256).toBe("0000000000000000000000000000000000000000000000000000000000000001");
    expect("storage_uri" in result.read_model).toBe(false);
    expect(result.read_model.redaction_decision.fields_redacted).toContain("storage_uri");
    expect(result.read_model.redaction_decision.storage_uri_exposed).toBe(false);
    expect(result.decision.decision_evidence.redaction_decision.storage_uri_exposed).toBe(false);
  });

  it("denies retention-inaccessible evidence before returning metadata", () => {
    const service = createEvidenceProjectionService({
      records: withRecord("EVID-IQW-001", (record) => ({
        ...record,
        projection: {
          ...record.projection,
          retention_status: "purge_due",
        },
      })),
    });
    const result = service.readEvidence("EVID-IQW-001", readInput(persona("supervisor"), "case_review"));

    expect(result.status).toBe("denied");
    if (result.status === "allowed") {
      throw new Error("retention-inaccessible evidence should not be allowed");
    }
    expect(result.decision.reason).toBe("SOURCE_STATUS_DENIED");
    expect(result.decision.decision_evidence.resource.source_status).toBe("retained_inaccessible");
  });

  it("records missing evidence projections as deny decision evidence", () => {
    const service = createEvidenceProjectionService();
    const result = service.readEvidence("EVID-MISSING-001", readInput(persona("supervisor"), "case_review"));

    expect(result.status).toBe("missing");
    if (result.status === "allowed") {
      throw new Error("missing evidence projection should not be allowed");
    }
    expect(result.decision.reason).toBe("RESOURCE_INCOMPLETE");
    expect(result.decision.decision_evidence.resource.resource_id).toBe("EVID-MISSING-001");
    expect(result.decision.decision_evidence.redaction_decision.storage_uri_exposed).toBe(false);
  });
});
