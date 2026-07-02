import { describe, expect, it } from "vitest";
import claimFixtures from "../../../../docs/spec/auth-claim-fixtures.json";
import casesFixture from "../../../../fixtures/platform/cases.json";
import denialsFixture from "../../../../fixtures/platform/denials.json";
import evidenceFixture from "../../../../fixtures/platform/evidence.json";
import usersFixture from "../../../../fixtures/platform/users.json";
import { type AbacOptions, type AbacRequest, evaluateAbac } from "../abac";
import type { PlatformClaims } from "../claims";
import { validatePlatformClaims } from "../claims";

interface ClaimFixture {
  id: string;
  claim: PlatformClaims;
}

interface AuthClaimFixtures {
  personas: ClaimFixture[];
}

interface PilotPersona {
  pilot_persona_id: string;
  claim_persona_id: string;
  user_id: string;
  pilot_flows: string[];
  control_plane_coverage: string[];
}

interface PilotUsersFixture {
  synthetic_data: boolean;
  claim_schema_version: string;
  personas: PilotPersona[];
}

interface PilotCase {
  case_id: string;
  source_system: string;
  linked_case_ids: string[];
}

interface PilotCasesFixture {
  synthetic_data: boolean;
  cases: PilotCase[];
  case_links: Array<{
    left_case_id: string;
    right_case_id: string;
  }>;
}

interface PilotEvidence {
  evidence_id: string;
  case_id: string;
  legal_hold_status: string;
  storage_uri_present: boolean;
}

interface PilotEvidenceFixture {
  synthetic_data: boolean;
  evidence: PilotEvidence[];
}

interface ExpectedDecision {
  allowed: boolean;
  reason: string;
  detail?: string;
  claim_validation_reason?: string;
  redaction_profile?: string;
  redacted_fields_include?: string[];
  storage_uri_exposed: boolean;
  decision_inputs?: Record<string, boolean>;
}

interface DecisionScenario {
  id: string;
  outcome_group: "allow" | "deny";
  claim_persona_id: string;
  claim_mutation?: JsonObject;
  control_plane_rules: string[];
  options: AbacOptions;
  request: AbacRequest;
  expected: ExpectedDecision;
}

interface DecisionScenariosFixture {
  synthetic_data: boolean;
  scenarios: DecisionScenario[];
}

type JsonObject = Record<string, unknown>;

const NOW = "2026-07-01T18:45:00Z";
const typedClaimFixtures = claimFixtures as AuthClaimFixtures;
const typedUsers = usersFixture as PilotUsersFixture;
const typedCases = casesFixture as PilotCasesFixture;
const typedEvidence = evidenceFixture as PilotEvidenceFixture;
const typedScenarios = denialsFixture as DecisionScenariosFixture;

function persona(id: string): PlatformClaims {
  const found = typedClaimFixtures.personas.find((entry) => entry.id === id);
  if (!found) {
    throw new Error(`missing fixture persona ${id}`);
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

function fixtureText(): string {
  return JSON.stringify([typedUsers, typedCases, typedEvidence, typedScenarios]);
}

describe("P4 pilot personas and control-plane fixtures", () => {
  it("keeps all pilot fixtures synthetic and free from live-data markers", () => {
    expect(typedUsers.synthetic_data).toBe(true);
    expect(typedCases.synthetic_data).toBe(true);
    expect(typedEvidence.synthetic_data).toBe(true);
    expect(typedScenarios.synthetic_data).toBe(true);

    const text = fixtureText();
    expect(text).not.toMatch(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    expect(text).not.toMatch(/\b(?:\+91[- ]?)?[6-9]\d{9}\b/);
    expect(text).not.toMatch(/\b[A-Z]{5}\d{4}[A-Z]\b/);
    expect(text).not.toContain("://");
  });

  it("maps pilot users to valid P2 claim personas", () => {
    const claimIds = typedClaimFixtures.personas.map((entry) => entry.id);
    typedUsers.personas.forEach((entry) => {
      expect(claimIds).toContain(entry.claim_persona_id);
      expect(entry.user_id).toMatch(/^user-[a-z-]+-001$/);
      expect(entry.pilot_flows.length).toBeGreaterThan(0);
      expect(entry.control_plane_coverage.length).toBeGreaterThan(0);

      const result = validatePlatformClaims(persona(entry.claim_persona_id), {
        now: NOW,
        expectedSourceVersion: "idp-seed-v1",
      });
      expect(result.valid, entry.claim_persona_id).toBe(true);
    });
  });

  it("links one DOPAMS case projection to one IQW case projection", () => {
    const dopams = typedCases.cases.find((entry) => entry.case_id === "CASE-DOPAMS-001");
    const iqw = typedCases.cases.find((entry) => entry.case_id === "CASE-IQW-001");

    expect(dopams?.source_system).toBe("dopams");
    expect(iqw?.source_system).toBe("iqw");
    expect(dopams?.linked_case_ids).toContain("CASE-IQW-001");
    expect(iqw?.linked_case_ids).toContain("CASE-DOPAMS-001");
    expect(typedCases.case_links).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          left_case_id: "CASE-DOPAMS-001",
          right_case_id: "CASE-IQW-001",
        }),
      ]),
    );
  });

  it("keeps central evidence metadata storage-location free", () => {
    expect(typedEvidence.evidence.map((entry) => entry.evidence_id).sort()).toEqual([
      "EVID-DOPAMS-001",
      "EVID-IQW-001",
    ]);
    expect(typedEvidence.evidence.some((entry) => entry.legal_hold_status === "active")).toBe(true);
    typedEvidence.evidence.forEach((entry) => {
      expect(entry.storage_uri_present).toBe(false);
      expect(entry.case_id).toMatch(/^CASE-/);
    });
  });

  it("evaluates every P4 allow and denial scenario through ABAC", () => {
    const scenarioIds = typedScenarios.scenarios.map((scenario) => scenario.id);
    expect(scenarioIds).toEqual([
      "allow_dopams_case_read",
      "allow_iqw_case_redacted",
      "allow_legal_hold_evidence_review",
      "deny_wrong_module_admin_to_dopams",
      "deny_wrong_jurisdiction",
      "deny_stale_projection",
      "deny_legal_hold_investigation",
      "deny_storage_uri_redaction",
      "deny_revocation_incompatible_claim_source",
    ]);

    typedScenarios.scenarios.forEach((scenario) => {
      const decision = evaluateAbac(claimForScenario(scenario), scenario.request, scenario.options);

      expect(decision.allowed, scenario.id).toBe(scenario.expected.allowed);
      expect(decision.reason, scenario.id).toBe(scenario.expected.reason);
      expect(decision.decision_evidence.path, scenario.id).toBe(scenario.request.path);
      expect(decision.decision_evidence.correlation_id, scenario.id).toBe(scenario.request.correlation_id);
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
      if (scenario.expected.redaction_profile) {
        expect(decision.decision_evidence.redaction_decision.profile, scenario.id).toBe(
          scenario.expected.redaction_profile,
        );
      }
      scenario.expected.redacted_fields_include?.forEach((field) => {
        expect(decision.decision_evidence.redaction_decision.fields_redacted, scenario.id).toContain(field);
      });
      Object.entries(scenario.expected.decision_inputs ?? {}).forEach(([key, value]) => {
        expect(decision.decision_evidence.decision_inputs[key as keyof typeof decision.decision_evidence.decision_inputs]).toBe(
          value,
        );
      });
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
