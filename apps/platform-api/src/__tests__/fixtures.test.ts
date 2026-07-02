import { describe, expect, it } from "vitest";
import claimFixtures from "../../../../docs/spec/auth-claim-fixtures.json";
import casesFixture from "../../../../fixtures/platform/cases.json";
import denialsFixture from "../../../../fixtures/platform/denials.json";
import evidenceFixture from "../../../../fixtures/platform/evidence.json";
import usersFixture from "../../../../fixtures/platform/users.json";
import { type AbacOptions, type AbacRequest, evaluateAbac } from "../../../../packages/authz/src/abac";
import type { PlatformClaims } from "../../../../packages/authz/src/claims";

interface ClaimFixture {
  id: string;
  claim: PlatformClaims;
}

interface AuthClaimFixtures {
  personas: ClaimFixture[];
}

interface FixtureHeader {
  schema_version: string;
  synthetic_data: boolean;
}

interface UsersFixture extends FixtureHeader {
  personas: Array<{
    claim_persona_id: string;
    user_id: string;
    pilot_flows: string[];
  }>;
}

interface CasesFixture extends FixtureHeader {
  cases: Array<{
    case_id: string;
    source_system: string;
    source_version: string;
    projection_version: string;
    default_redaction_decision: {
      storage_uri_exposed: boolean;
    };
  }>;
}

interface EvidenceFixture extends FixtureHeader {
  evidence: Array<{
    evidence_id: string;
    case_id: string;
    legal_hold_status: string;
    storage_uri_present: boolean;
  }>;
}

interface ExpectedDecision {
  allowed: boolean;
  reason: string;
  detail?: string;
  claim_validation_reason?: string;
  storage_uri_exposed: boolean;
}

interface DecisionScenario {
  id: string;
  claim_persona_id: string;
  claim_mutation?: JsonObject;
  control_plane_rules: string[];
  options: AbacOptions;
  request: AbacRequest;
  expected: ExpectedDecision;
}

interface DecisionFixture extends FixtureHeader {
  scenarios: DecisionScenario[];
}

type JsonObject = Record<string, unknown>;

const typedClaimFixtures = claimFixtures as AuthClaimFixtures;
const typedUsers = usersFixture as UsersFixture;
const typedCases = casesFixture as CasesFixture;
const typedEvidence = evidenceFixture as EvidenceFixture;
const typedDecisions = denialsFixture as DecisionFixture;

function persona(id: string): PlatformClaims {
  const found = typedClaimFixtures.personas.find((entry) => entry.id === id);
  if (!found) {
    throw new Error(`missing claim persona ${id}`);
  }
  return clone(found.claim);
}

function claimForScenario(scenario: DecisionScenario): PlatformClaims {
  const base = persona(scenario.claim_persona_id);
  if (!scenario.claim_mutation) {
    return base;
  }
  return deepMerge(base as unknown as JsonObject, scenario.claim_mutation) as unknown as PlatformClaims;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function deepMerge(base: JsonObject, patch: JsonObject): JsonObject {
  const output: JsonObject = { ...base };
  Object.entries(patch).forEach(([key, value]) => {
    const existing = output[key];
    output[key] = isRecord(existing) && isRecord(value) ? deepMerge(existing, value) : value;
  });
  return output;
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

describe("platform API pilot fixture contract", () => {
  it("loads only versioned synthetic fixture documents", () => {
    [typedUsers, typedCases, typedEvidence, typedDecisions].forEach((fixture) => {
      expect(fixture.schema_version).toMatch(/^platform\./);
      expect(fixture.synthetic_data).toBe(true);
    });
  });

  it("keeps fixture scope bounded to DOPAMS and IQW pilot projections per state", () => {
    expect([...new Set(typedCases.cases.map((entry) => entry.source_system))].sort()).toEqual([
      "dopams",
      "iqw",
    ]);
    const expectedCaseIds = [
      "CASE-DOPAMS-001",
      "CASE-DOPAMS-KL-001",
      "CASE-DOPAMS-TG-001",
      "CASE-IQW-001",
      "CASE-IQW-KL-001",
      "CASE-IQW-TG-001",
    ];
    expect(typedCases.cases.map((entry) => entry.case_id).sort()).toEqual(expectedCaseIds);
    expect(typedEvidence.evidence.map((entry) => entry.case_id).sort()).toEqual(expectedCaseIds);
    expect(typedUsers.personas.flatMap((entry) => entry.pilot_flows)).toEqual(
      expect.arrayContaining(["allow_dopams_case_read", "allow_iqw_case_redacted"]),
    );
  });

  it("does not expose storage locations in case or evidence fixtures", () => {
    typedCases.cases.forEach((entry) => {
      expect(entry.default_redaction_decision.storage_uri_exposed).toBe(false);
    });
    typedEvidence.evidence.forEach((entry) => {
      expect(entry.storage_uri_present).toBe(false);
    });
    expect(JSON.stringify([typedCases, typedEvidence])).not.toContain("://");
  });

  it("maps each platform decision scenario to ABAC inputs and expected evidence", () => {
    const requiredRules = [
      "allow",
      "deny",
      "redaction",
      "legal_hold",
      "stale",
      "revocation",
      "wrong_module",
      "wrong_jurisdiction",
    ];
    const coveredRules = new Set(typedDecisions.scenarios.flatMap((scenario) => scenario.control_plane_rules));
    requiredRules.forEach((rule) => {
      expect(coveredRules.has(rule), rule).toBe(true);
    });

    typedDecisions.scenarios.forEach((scenario) => {
      const decision = evaluateAbac(claimForScenario(scenario), scenario.request, scenario.options);

      expect(decision.allowed, scenario.id).toBe(scenario.expected.allowed);
      expect(decision.reason, scenario.id).toBe(scenario.expected.reason);
      expect(decision.decision_evidence.outcome, scenario.id).toBe(scenario.expected.allowed ? "allow" : "deny");
      expect(decision.decision_evidence.policy_version, scenario.id).toBe("platform.abac.v1");
      expect(decision.decision_evidence.entitlement_policy_version, scenario.id).toBe("platform.entitlements.v1");
      expect(decision.decision_evidence.resource.source_version, scenario.id).toBe(
        scenario.request.resource.source_version,
      );
      expect(decision.decision_evidence.resource.projection_version, scenario.id).toBe(
        scenario.request.resource.projection_version,
      );
      expect(decision.decision_evidence.redaction_decision.storage_uri_exposed, scenario.id).toBe(
        scenario.expected.storage_uri_exposed,
      );

      if (!decision.allowed && scenario.expected.detail) {
        expect(decision.detail, scenario.id).toBe(scenario.expected.detail);
      }
      if (scenario.expected.claim_validation_reason) {
        expect(decision.decision_evidence.claims_snapshot.validation, scenario.id).toBe("invalid");
        if (decision.decision_evidence.claims_snapshot.validation === "invalid") {
          expect(decision.decision_evidence.claims_snapshot.validation_reason, scenario.id).toBe(
            scenario.expected.claim_validation_reason,
          );
        }
      }
    });
  });
});
