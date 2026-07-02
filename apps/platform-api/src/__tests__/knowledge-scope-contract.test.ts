import { describe, expect, it } from "vitest";
import claimFixtures from "../../../../docs/spec/auth-claim-fixtures.json";
import { evaluateAbac, type AbacDecision, type AbacRequest, type RedactionDecision } from "../../../../packages/authz/src/abac";
import type { ClearanceLevel, PlatformClaims } from "../../../../packages/authz/src";
import { defaultPlatformApps } from "../app-registry";

interface ClaimFixture {
  id: string;
  claim: PlatformClaims;
}

interface ClaimFixtureDocument {
  personas: ClaimFixture[];
}

interface KnowledgeCandidate {
  citation_id: string;
  resource_id: string;
  source_system: string;
  source_record_id: string;
  classification: ClearanceLevel;
  jurisdiction: {
    country: string;
    state: string;
    district: string;
    police_station: string;
  };
  assignment: {
    case_id: string;
  };
  redaction_decision: RedactionDecision;
}

interface ScopeAuditEntry {
  citation_id: string;
  allowed: boolean;
  reason: string;
  decision_evidence_id: string;
}

interface SearchResult {
  citation_id: string;
  backend: "vector" | "graph";
}

interface GeneratedCitation {
  citation_id: string;
  text: string;
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

function syntheticCandidates(): KnowledgeCandidate[] {
  return [
    {
      citation_id: "cit-case-allowed",
      resource_id: "CASE-DOPAMS-001",
      source_system: "dopams",
      source_record_id: "CASE-DOPAMS-001",
      classification: "confidential",
      jurisdiction: {
        country: "IN",
        state: "PB",
        district: "SAS Nagar",
        police_station: "Phase-8",
      },
      assignment: { case_id: "CASE-DOPAMS-001" },
      redaction_decision: {
        profile: "knowledge-case-summary-v1",
        fields_redacted: ["subject_identifiers", "storage_uri"],
        storage_uri_exposed: false,
        reason: "platform_knowledge_summary",
      },
    },
    {
      citation_id: "cit-wrong-jurisdiction",
      resource_id: "CASE-DOPAMS-009",
      source_system: "dopams",
      source_record_id: "CASE-DOPAMS-009",
      classification: "confidential",
      jurisdiction: {
        country: "IN",
        state: "PB",
        district: "Ludhiana",
        police_station: "Division-5",
      },
      assignment: { case_id: "CASE-DOPAMS-009" },
      redaction_decision: {
        profile: "knowledge-case-summary-v1",
        fields_redacted: ["subject_identifiers", "storage_uri"],
        storage_uri_exposed: false,
        reason: "platform_knowledge_summary",
      },
    },
    {
      citation_id: "cit-secret-classification",
      resource_id: "CASE-DOPAMS-001-SECRET",
      source_system: "dopams",
      source_record_id: "CASE-DOPAMS-001-SECRET",
      classification: "secret",
      jurisdiction: {
        country: "IN",
        state: "PB",
        district: "SAS Nagar",
        police_station: "Phase-8",
      },
      assignment: { case_id: "CASE-DOPAMS-001" },
      redaction_decision: {
        profile: "knowledge-case-summary-v1",
        fields_redacted: ["all_secret_fields", "storage_uri"],
        storage_uri_exposed: false,
        reason: "platform_knowledge_summary",
      },
    },
  ];
}

function directReadRequest(candidate: KnowledgeCandidate, correlationId: string): AbacRequest {
  return {
    action: "platform.case.read",
    path: `/api/v1/platform/knowledge/scope/${candidate.citation_id}`,
    correlation_id: correlationId,
    module: "dopams",
    domain: "dopams",
    permission: "case:read",
    purpose: "case_review",
    require_mfa: true,
    server_verified: true,
    resource: {
      kind: "platform_case",
      resource_id: candidate.resource_id,
      source_system: candidate.source_system,
      source_record_id: candidate.source_record_id,
      source_version: "dopams-source-v1",
      projection_version: "platform-knowledge-v1",
      projected_at: NOW,
      source_status: "active",
      classification: candidate.classification,
      org_id: "mohali-district",
      unit_id: "narcotics-cell-mohali",
      jurisdiction: candidate.jurisdiction,
      assignment: candidate.assignment,
      legal_hold_status: "none",
    },
    redaction_decision: candidate.redaction_decision,
  };
}

function knowledgeRetrieveRequest(candidate: KnowledgeCandidate): AbacRequest {
  return {
    ...directReadRequest(candidate, "corr-p10-knowledge-route-deny"),
    action: "platform.knowledge.retrieve",
    path: "/api/v1/platform/knowledge/query",
    module: "knowledge",
    domain: "knowledge",
    permission: "query:case-summary",
    resource: {
      ...directReadRequest(candidate, "corr-p10-knowledge-route-deny").resource,
      kind: "knowledge_citation",
    },
  };
}

function preRetrievalScope(
  claim: PlatformClaims,
  candidates: readonly KnowledgeCandidate[],
): {
  allowedCitationIds: Set<string>;
  audit: ScopeAuditEntry[];
  decisions: AbacDecision[];
} {
  const decisions = candidates.map((candidate) =>
    evaluateAbac(claim, directReadRequest(candidate, "corr-p10-knowledge-scope"), { now: NOW }),
  );
  const audit = decisions.map((decision, index) => ({
    citation_id: candidates[index]?.citation_id ?? "missing",
    allowed: decision.allowed,
    reason: decision.reason,
    decision_evidence_id: `${decision.decision_evidence.correlation_id}:${decision.decision_evidence.resource.resource_id}`,
  }));
  return {
    allowedCitationIds: new Set(audit.filter((entry) => entry.allowed).map((entry) => entry.citation_id)),
    audit,
    decisions,
  };
}

function runScopedSearch(
  backend: "vector" | "graph",
  candidates: readonly KnowledgeCandidate[],
  allowedCitationIds: ReadonlySet<string>,
  operations: string[],
): SearchResult[] {
  operations.push(`${backend}_search`);
  const leaked = candidates.filter((candidate) => !allowedCitationIds.has(candidate.citation_id));
  expect(leaked.map((candidate) => candidate.citation_id), backend).toEqual([]);
  return candidates.map((candidate) => ({ citation_id: candidate.citation_id, backend }));
}

function filterCitations(
  generated: readonly GeneratedCitation[],
  allowedCitationIds: ReadonlySet<string>,
): {
  retained: GeneratedCitation[];
  dropped: ScopeAuditEntry[];
} {
  return {
    retained: generated.filter((citation) => allowedCitationIds.has(citation.citation_id)),
    dropped: generated
      .filter((citation) => !allowedCitationIds.has(citation.citation_id))
      .map((citation) => ({
        citation_id: citation.citation_id,
        allowed: false,
        reason: "CITATION_SCOPE_DENIED",
        decision_evidence_id: "corr-p10-knowledge-citation-filter",
      })),
  };
}

describe("P10 knowledge retrieval scope contract", () => {
  it("keeps direct knowledge retrieval default-denied while P15 exposes only the gated pilot route", () => {
    const knowledgeApp = defaultPlatformApps().find((app) => app.id === "knowledge");
    if (!knowledgeApp) {
      throw new Error("missing knowledge app registry entry");
    }

    expect(knowledgeApp.state).toBe("pilot");
    expect(knowledgeApp.launch_url).toBe("/domains/knowledge");
    expect(knowledgeApp.platform_claim_gate.status).toBe("passed");
    expect(knowledgeApp.platform_claim_gate.evidence_ref).toBe("P15-knowledge-platform-auth-adapter");

    const decision = evaluateAbac(
      persona("io"),
      knowledgeRetrieveRequest(syntheticCandidates()[0]),
      { now: NOW },
    );

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("KNOWLEDGE_RETRIEVAL_DISABLED");
    expect(decision.decision_evidence.outcome).toBe("deny");

    const adapterDecision = evaluateAbac(
      persona("io"),
      knowledgeRetrieveRequest(syntheticCandidates()[0]),
      { now: NOW, knowledgeRetrievalEnabled: true },
    );

    expect(adapterDecision.allowed).toBe(true);
    expect(adapterDecision.decision_evidence.outcome).toBe("allow");
  });

  it("scopes candidate IDs before vector or graph search and audits denials", () => {
    const operations: string[] = [];
    const candidates = syntheticCandidates();

    operations.push("pre_retrieval_scope");
    const scope = preRetrievalScope(persona("io"), candidates);
    const scopedCandidates = candidates.filter((candidate) => scope.allowedCitationIds.has(candidate.citation_id));

    const vectorResults = runScopedSearch("vector", scopedCandidates, scope.allowedCitationIds, operations);
    const graphResults = runScopedSearch("graph", scopedCandidates, scope.allowedCitationIds, operations);

    expect(Array.from(scope.allowedCitationIds)).toEqual(["cit-case-allowed"]);
    expect(scope.audit).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ citation_id: "cit-case-allowed", allowed: true, reason: "ALLOW" }),
        expect.objectContaining({ citation_id: "cit-wrong-jurisdiction", allowed: false }),
        expect.objectContaining({ citation_id: "cit-secret-classification", allowed: false }),
      ]),
    );
    expect(vectorResults).toEqual([{ citation_id: "cit-case-allowed", backend: "vector" }]);
    expect(graphResults).toEqual([{ citation_id: "cit-case-allowed", backend: "graph" }]);
    expect(operations).toEqual(["pre_retrieval_scope", "vector_search", "graph_search"]);
  });

  it("filters citations before response and records dropped citation audit entries", () => {
    const scope = preRetrievalScope(persona("io"), syntheticCandidates());
    const generatedCitations: GeneratedCitation[] = [
      { citation_id: "cit-case-allowed", text: "Synthetic scoped citation" },
      { citation_id: "cit-secret-classification", text: "Synthetic unauthorized citation" },
      { citation_id: "cit-hallucinated", text: "Synthetic hallucinated citation" },
    ];

    const filtered = filterCitations(generatedCitations, scope.allowedCitationIds);

    expect(filtered.retained).toEqual([{ citation_id: "cit-case-allowed", text: "Synthetic scoped citation" }]);
    expect(filtered.dropped.map((entry) => entry.citation_id)).toEqual([
      "cit-secret-classification",
      "cit-hallucinated",
    ]);
    filtered.dropped.forEach((entry) => {
      expect(entry.reason).toBe("CITATION_SCOPE_DENIED");
      expect(entry.decision_evidence_id).toBe("corr-p10-knowledge-citation-filter");
    });
  });
});
