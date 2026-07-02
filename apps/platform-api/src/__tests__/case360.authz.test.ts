import { describe, expect, it } from "vitest";
import claimFixtures from "../../../../docs/spec/auth-claim-fixtures.json";
import type { PlatformClaims } from "../../../../packages/authz/src";
import { createPlatformApp } from "../app";
import { createCaseProjectionService, recordsFromFixture } from "../services/case-projection";

interface ClaimFixture {
  id: string;
  claim: PlatformClaims;
}

interface ClaimFixtureDocument {
  personas: ClaimFixture[];
}

interface Case360Body {
  case360_version: string;
  case_id: string;
  primary_case: {
    case_id: string | null;
    redaction_decision: {
      storage_uri_exposed: boolean;
    };
  };
  linked_cases: Array<{
    case_id: string | null;
    title: string | null;
    summary: string | null;
  }>;
  evidence: Array<{
    evidence_id: string | null;
    case_id: string | null;
    redaction_decision: {
      fields_redacted: string[];
      storage_uri_exposed: boolean;
    };
  }>;
  degraded: Array<{
    resource_kind: string;
    resource_id: string;
    reason: string;
    decision_evidence_id: string;
  }>;
  decision_evidence: Array<{
    decision_id: string;
    outcome: "allow" | "deny";
    reason: string;
    resource: {
      kind: string;
      resource_id: string;
    };
  }>;
}

interface ErrorBody {
  error: {
    code: string;
    reason: string;
    detail?: string;
  };
  decision_evidence: {
    decision_id: string;
    outcome: "allow" | "deny";
    reason: string;
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

function case360Request(
  caseId: string,
  claim: PlatformClaims,
  correlationId: string,
  purpose = "case_review",
): Request {
  return new Request(`http://platform.test/api/v1/platform/cases/${caseId}/case360?purpose=${purpose}`, {
    headers: {
      "x-platform-claims": JSON.stringify(claim),
      "x-platform-claims-verified": "true",
      "x-correlation-id": correlationId,
    },
  });
}

function hasPropertyNamed(value: unknown, propertyName: string): boolean {
  if (Array.isArray(value)) {
    return value.some((entry) => hasPropertyNamed(entry, propertyName));
  }
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return Object.keys(record).includes(propertyName) || Object.values(record).some((entry) => hasPropertyNamed(entry, propertyName));
}

describe("P9 Case 360 authorization route", () => {
  it("returns the linked DOPAMS plus IQW pilot case and records decision evidence for every read", async () => {
    const app = createPlatformApp({ now: () => new Date(NOW) });
    const response = await app.handle(
      case360Request("CASE-DOPAMS-001", persona("supervisor"), "corr-p9-case360-allow"),
    );
    const body = (await response.json()) as Case360Body;
    const evidenceLog = app.decisionEvidence.all();

    expect(response.status).toBe(200);
    expect(body.case360_version).toBe("platform.case360.v1");
    expect(body.primary_case.case_id).toBe("CASE-DOPAMS-001");
    expect(body.linked_cases.map((entry) => entry.case_id)).toEqual(["CASE-IQW-001"]);
    expect(body.linked_cases[0]?.title).toBeNull();
    expect(body.linked_cases[0]?.summary).toBeNull();
    expect(body.evidence.map((entry) => entry.case_id)).toEqual(["CASE-IQW-001"]);
    expect(body.degraded).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          resource_kind: "platform_evidence",
          resource_id: "EVID-DOPAMS-001",
          reason: "LEGAL_HOLD_DENIED",
        }),
      ]),
    );
    expect(body.decision_evidence).toHaveLength(4);
    expect(evidenceLog).toHaveLength(4);
    expect(evidenceLog.map((entry) => entry.resource.resource_id)).toEqual([
      "CASE-DOPAMS-001",
      "CASE-IQW-001",
      "EVID-DOPAMS-001",
      "EVID-IQW-001",
    ]);
    evidenceLog.forEach((entry) => {
      expect(entry.correlation_id).toBe("corr-p9-case360-allow");
      expect(entry.redaction_decision.storage_uri_exposed).toBe(false);
    });
    expect(hasPropertyNamed(body.evidence, "storage_uri")).toBe(false);
  });

  it("denies unauthorized platform admins and still writes deny decision evidence", async () => {
    const app = createPlatformApp({ now: () => new Date(NOW) });
    const response = await app.handle(
      case360Request("CASE-DOPAMS-001", persona("admin"), "corr-p9-case360-admin-deny"),
    );
    const body = (await response.json()) as ErrorBody;
    const evidence = app.decisionEvidence.all()[0];

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("CASE360_DENIED");
    expect(body.error.reason).toBe("ENTITLEMENT_DENIED");
    expect(body.error.detail).toBe("MODULE_DENIED");
    expect(body.decision_evidence.outcome).toBe("deny");
    expect(evidence?.reason).toBe("ENTITLEMENT_DENIED");
    expect(evidence?.resource.resource_id).toBe("CASE-DOPAMS-001");
    expect(evidence?.redaction_decision.storage_uri_exposed).toBe(false);
  });

  it("denies stale primary projections before linked cases or evidence are read", async () => {
    const caseProjectionService = createCaseProjectionService({
      records: recordsFromFixture().map((record) =>
        record.projection.case_id === "CASE-DOPAMS-001"
          ? {
              ...record,
              projection: {
                ...record.projection,
                projected_at: "2026-07-01T18:30:00Z",
              },
            }
          : record,
      ),
    });
    const app = createPlatformApp({
      caseProjectionService,
      now: () => new Date(NOW),
    });
    const response = await app.handle(
      case360Request("CASE-DOPAMS-001", persona("supervisor"), "corr-p9-case360-stale-deny"),
    );
    const body = (await response.json()) as ErrorBody;
    const evidence = app.decisionEvidence.all();

    expect(response.status).toBe(403);
    expect(body.error.reason).toBe("STALE_PROJECTION");
    expect(evidence).toHaveLength(1);
    expect(evidence[0]?.decision_inputs.projection_fresh).toBe(false);
    expect(evidence[0]?.resource.projection_version).toBe("platform-case-v1");
  });
});
