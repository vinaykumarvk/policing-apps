import { describe, expect, it } from "vitest";
import claimFixtures from "../../../../../docs/spec/auth-claim-fixtures.json";
import { evaluateAbac, type AbacRequest, type PlatformClaims } from "@policing-platform/authz";
import {
  evaluateKnowledgePlatformAuth,
  knowledgeRetrievalRequestForCandidate,
  syntheticKnowledgeCandidates,
  syntheticKnowledgeCitations,
  type KnowledgePlatformAuthOptions,
} from "../platform-auth";
import {
  buildPreRetrievalScope,
  filterCandidatesForSearch,
  filterCitations,
  type KnowledgeCandidateMetadata,
  type KnowledgeSearchBackend,
  type KnowledgeScopeDecision,
} from "../platform-scope";

interface ClaimFixture {
  id: string;
  claim: PlatformClaims;
}

interface ClaimFixtureDocument {
  personas: ClaimFixture[];
}

interface RuntimeSearchResult {
  citation_id: string;
  backend: KnowledgeSearchBackend;
}

const NOW = "2026-07-01T18:45:00Z";
const typedClaimFixtures = claimFixtures as ClaimFixtureDocument;

function persona(id: string): PlatformClaims {
  const found = typedClaimFixtures.personas.find((entry) => entry.id === id);
  if (!found) {
    throw new Error(`missing persona ${id}`);
  }
  return cloneClaim(found.claim);
}

function cloneClaim(claim: PlatformClaims): PlatformClaims {
  return JSON.parse(JSON.stringify(claim)) as PlatformClaims;
}

function platformInput(claim: PlatformClaims = persona("io")) {
  return {
    claims: claim,
    serverVerified: true,
    servicePath: "/domains/knowledge/health",
    correlationId: "corr-p15-knowledge-test",
  };
}

function runRuntimeSearch(
  backend: KnowledgeSearchBackend,
  scopedCandidates: readonly KnowledgeCandidateMetadata[],
  allowedCitationIds: ReadonlySet<string>,
  operations: string[],
): RuntimeSearchResult[] {
  operations.push(`${backend}_search`);
  expect(scopedCandidates.every((candidate) => allowedCitationIds.has(candidate.citation_id))).toBe(true);
  return scopedCandidates.map((candidate) => ({ citation_id: candidate.citation_id, backend }));
}

describe("P15 Knowledge platform auth adapter", () => {
  it("allows a server-verified entitled IO claim and records P15 decision evidence", () => {
    const decision = evaluateKnowledgePlatformAuth(platformInput(), { now: NOW });

    if (!decision.allowed) {
      throw new Error(`expected allow, got ${decision.reason}`);
    }

    expect(decision.reason).toBe("ALLOW");
    expect(decision.evidence.adapter_version).toBe("knowledge-platform-auth-adapter.v1");
    expect(decision.evidence.gate_evidence_ref).toBe("P15-knowledge-platform-auth-adapter");
    expect(decision.evidence.policy_version).toBe("platform.entitlements.v1");
    expect(decision.evidence.service_path).toBe("/domains/knowledge/health");
    expect(decision.evidence.outcome).toBe("ALLOW");
    expect(decision.evidence.server_verified).toBe(true);
    expect(decision.evidence.snapshot_version).toBe("knowledge-snapshot-p15-v1");
    expect(decision.evidence.projection_version).toBe("platform-knowledge-p15-v1");
    expect(decision.evidence.redaction_decision).toBe("knowledge-case-summary-v1");
    expect(decision.evidence.claims_snapshot?.persona).toBe("io");
    expect(decision.scope.allowed_citation_ids).toEqual(["cit-case-allowed"]);
    expect(decision.evidence.scope?.search_plan.vector).toEqual(["cit-case-allowed"]);
    expect(decision.citations.retained.map((citation) => citation.citation_id)).toEqual(["cit-case-allowed"]);
    expect(decision.citations.dropped.map((drop) => drop.citation.citation_id)).toEqual([
      "cit-secret-classification",
      "cit-hallucinated",
    ]);
  });

  it("denies missing and malformed platform claims", () => {
    const missing = evaluateKnowledgePlatformAuth(
      {
        serverVerified: true,
        servicePath: "/domains/knowledge/health",
        correlationId: "corr-p15-missing",
      },
      { now: NOW },
    );
    const malformed = evaluateKnowledgePlatformAuth(
      {
        claimsParseError: "x-platform-claims must be valid JSON",
        serverVerified: true,
        servicePath: "/domains/knowledge/health",
        correlationId: "corr-p15-malformed",
      },
      { now: NOW },
    );

    expect(missing.allowed).toBe(false);
    expect(missing.reason).toBe("PLATFORM_CLAIMS_REQUIRED");
    expect(malformed.allowed).toBe(false);
    expect(malformed.reason).toBe("CLAIM_MALFORMED");
  });

  it.each([
    {
      label: "unverified claims",
      mutate: (claim: PlatformClaims) => claim,
      input: { serverVerified: false },
      options: {},
      expected: "SERVER_VERIFICATION_REQUIRED",
    },
    {
      label: "wrong module",
      mutate: (claim: PlatformClaims) => {
        claim.modules = claim.modules.filter((module) => module !== "knowledge");
        return claim;
      },
      input: {},
      options: {},
      expected: "MODULE_DENIED",
    },
    {
      label: "wrong jurisdiction",
      mutate: (claim: PlatformClaims) => {
        claim.jurisdiction.districts = ["Ludhiana"];
        claim.jurisdiction.police_stations = ["Division-5"];
        return claim;
      },
      input: {},
      options: {},
      expected: "JURISDICTION_DENIED",
    },
    {
      label: "wrong clearance",
      mutate: (claim: PlatformClaims) => {
        claim.clearance.level = "restricted";
        return claim;
      },
      input: {},
      options: {},
      expected: "CLEARANCE_DENIED",
    },
    {
      label: "wrong assignment",
      mutate: (claim: PlatformClaims) => {
        claim.assignment.case_ids = ["CASE-DOPAMS-999"];
        return claim;
      },
      input: {},
      options: {},
      expected: "ASSIGNMENT_DENIED",
    },
    {
      label: "wrong purpose",
      mutate: (claim: PlatformClaims) => {
        claim.purpose.allowed = ["investigation"];
        return claim;
      },
      input: {},
      options: {},
      expected: "PURPOSE_DENIED",
    },
    {
      label: "stale claim",
      mutate: (claim: PlatformClaims) => claim,
      input: {},
      options: { maxAgeSeconds: 60 },
      expected: "CLAIM_STALE",
    },
    {
      label: "revoked claim",
      mutate: (claim: PlatformClaims) => claim,
      input: {},
      options: { revokedSessionIds: ["sess-io-001"] },
      expected: "PLATFORM_SESSION_REVOKED",
    },
  ])("denies $label", ({ mutate, input, options, expected }) => {
    const claim = mutate(persona("io"));
    const decision = evaluateKnowledgePlatformAuth(
      {
        ...platformInput(claim),
        ...input,
      },
      {
        now: NOW,
        ...(options as KnowledgePlatformAuthOptions),
      },
    );

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe(expected);
    expect(decision.evidence.outcome).toBe("DENY");
    expect(decision.evidence.gate_evidence_ref).toBe("P15-knowledge-platform-auth-adapter");
  });

  it("preserves default ABAC deny unless the adapter explicitly enables scoped retrieval", () => {
    const request: AbacRequest = knowledgeRetrievalRequestForCandidate(syntheticKnowledgeCandidates()[0], platformInput());
    const defaultDecision = evaluateAbac(persona("io"), request, { now: NOW });
    const adapterDecision = evaluateAbac(persona("io"), request, { now: NOW, knowledgeRetrievalEnabled: true });

    expect(defaultDecision.allowed).toBe(false);
    expect(defaultDecision.reason).toBe("KNOWLEDGE_RETRIEVAL_DISABLED");
    expect(adapterDecision.allowed).toBe(true);
  });

  it("builds scope before search and only passes allowed candidates to retrieval backends", () => {
    const operations: string[] = [];
    const candidates = syntheticKnowledgeCandidates();
    const decisions: KnowledgeScopeDecision[] = [
      {
        citation_id: "cit-case-allowed",
        allowed: true,
        reason: "ALLOW",
        decision_evidence_id: "decision-allowed",
      },
      {
        citation_id: "cit-wrong-jurisdiction",
        allowed: false,
        reason: "JURISDICTION_DENIED",
        decision_evidence_id: "decision-jurisdiction",
      },
      {
        citation_id: "cit-secret-classification",
        allowed: false,
        reason: "CLASSIFICATION_DENIED",
        decision_evidence_id: "decision-clearance",
      },
    ];

    operations.push("pre_retrieval_scope");
    const scope = buildPreRetrievalScope(candidates, decisions, { snapshotVersion: "knowledge-snapshot-p15-v1" });
    const allowedCitationIds = new Set(scope.allowed_citation_ids);
    const vectorResults = runRuntimeSearch(
      "vector",
      filterCandidatesForSearch(candidates, scope, "vector"),
      allowedCitationIds,
      operations,
    );
    const graphResults = runRuntimeSearch(
      "graph",
      filterCandidatesForSearch(candidates, scope, "graph"),
      allowedCitationIds,
      operations,
    );

    expect(scope.allowed_citation_ids).toEqual(["cit-case-allowed"]);
    expect(scope.denied_decisions.map((decision) => decision.reason)).toEqual([
      "JURISDICTION_DENIED",
      "CLASSIFICATION_DENIED",
    ]);
    expect(vectorResults).toEqual([{ citation_id: "cit-case-allowed", backend: "vector" }]);
    expect(graphResults).toEqual([{ citation_id: "cit-case-allowed", backend: "graph" }]);
    expect(operations).toEqual(["pre_retrieval_scope", "vector_search", "graph_search"]);
  });

  it("filters citations before response and denies unsupported answers", () => {
    const candidates = syntheticKnowledgeCandidates();
    const scope = buildPreRetrievalScope(candidates, [
      {
        citation_id: "cit-case-allowed",
        allowed: true,
        reason: "ALLOW",
        decision_evidence_id: "decision-allowed",
      },
    ]);
    const filtered = filterCitations(syntheticKnowledgeCitations(), scope);

    expect(filtered.retained.map((citation) => citation.citation_id)).toEqual(["cit-case-allowed"]);
    expect(filtered.dropped.map((drop) => drop.reason)).toEqual([
      "CITATION_SCOPE_DENIED",
      "CITATION_SCOPE_DENIED",
    ]);

    const denySafe = evaluateKnowledgePlatformAuth(
      {
        ...platformInput(),
        generatedCitations: [
          { citation_id: "cit-secret-classification", label: "Denied", excerpt: "Synthetic denied citation" },
        ],
      },
      { now: NOW },
    );

    expect(denySafe.allowed).toBe(false);
    expect(denySafe.reason).toBe("CITATION_SCOPE_DENIED");
    expect(denySafe.evidence.scope?.citation_filter?.retained_citation_ids).toEqual([]);
    expect(denySafe.evidence.scope?.citation_filter?.dropped_citation_ids).toEqual(["cit-secret-classification"]);
  });
});
