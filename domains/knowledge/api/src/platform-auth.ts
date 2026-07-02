import {
  type AbacDecision,
  type AbacDenyReason,
  type AbacRequest,
  type ClaimRejectionReason,
  type EntitlementDecision,
  type EntitlementDenyReason,
  type EntitlementRequest,
  type PlatformClaimSnapshot,
  type PlatformClaims,
  claimEvidenceSnapshot,
  evaluateAbac,
  evaluateEntitlement,
  validatePlatformClaims,
} from "@policing-platform/authz";
import {
  buildPreRetrievalScope,
  filterCandidatesForSearch,
  filterCitations,
  type KnowledgeCandidateMetadata,
  type KnowledgeCitationFilterResult,
  type KnowledgeGeneratedCitation,
  type KnowledgePreRetrievalScope,
  type KnowledgeScopeAuditEvent,
  type KnowledgeScopeDecision,
} from "./platform-scope";

export const KNOWLEDGE_PLATFORM_AUTH_ADAPTER_VERSION = "knowledge-platform-auth-adapter.v1";
export const KNOWLEDGE_PLATFORM_AUTH_GATE_EVIDENCE_REF = "P15-knowledge-platform-auth-adapter";
export const KNOWLEDGE_PLATFORM_SNAPSHOT_VERSION = "knowledge-snapshot-p15-v1";
export const KNOWLEDGE_PLATFORM_PROJECTION_VERSION = "platform-knowledge-p15-v1";

export const KNOWLEDGE_PLATFORM_ENTITLEMENT_REQUEST: Omit<EntitlementRequest, "serverVerified"> = {
  module: "knowledge",
  domain: "knowledge",
  permission: "query:case-summary",
  org_id: "mohali-district",
  unit_id: "narcotics-cell-mohali",
  jurisdiction: {
    country: "IN",
    state: "PB",
    district: "SAS Nagar",
    police_station: "Phase-8",
  },
  requiredClearance: "confidential",
  assignment: { case_id: "CASE-DOPAMS-001" },
  purpose: "case_review",
  requireMfa: true,
};

export type KnowledgePlatformAuthReason =
  | "ALLOW"
  | "PLATFORM_CLAIMS_REQUIRED"
  | "PLATFORM_SESSION_REVOKED"
  | "CLAIM_MALFORMED"
  | "SCOPE_EMPTY"
  | "CITATION_SCOPE_DENIED"
  | ClaimRejectionReason
  | EntitlementDenyReason
  | AbacDenyReason;

export interface KnowledgePlatformScopeEvidence {
  snapshot_version: string;
  allowed_candidate_count: number;
  denied_candidate_count: number;
  retained_citation_count: number;
  dropped_citation_count: number;
  search_plan: {
    cache: readonly string[];
    vector: readonly string[];
    graph: readonly string[];
    lexical: readonly string[];
    wiki: readonly string[];
  };
  pre_retrieval: KnowledgeScopeAuditEvent;
  citation_filter?: KnowledgeScopeAuditEvent;
}

export interface KnowledgePlatformAuthEvidence {
  adapter_version: string;
  gate_evidence_ref: string;
  policy_version: string;
  service_path: string;
  outcome: "ALLOW" | "DENY";
  reason: KnowledgePlatformAuthReason;
  correlation_id: string;
  source_version: string;
  snapshot_version: string;
  projection_version: string;
  redaction_decision: string;
  server_verified: boolean;
  audited_at: string;
  claims_snapshot?: PlatformClaimSnapshot;
  scope?: KnowledgePlatformScopeEvidence;
}

export type KnowledgePlatformAuthDecision =
  | {
      allowed: true;
      reason: "ALLOW";
      evidence: KnowledgePlatformAuthEvidence;
      entitlement: Extract<EntitlementDecision, { allowed: true }>;
      scope: KnowledgePreRetrievalScope;
      citations: KnowledgeCitationFilterResult;
    }
  | {
      allowed: false;
      reason: Exclude<KnowledgePlatformAuthReason, "ALLOW">;
      evidence: KnowledgePlatformAuthEvidence;
      entitlement?: EntitlementDecision;
      scope?: KnowledgePreRetrievalScope;
      citations?: KnowledgeCitationFilterResult;
    };

export interface KnowledgePlatformAuthInput {
  claims?: unknown;
  claimsParseError?: string;
  serverVerified: boolean;
  servicePath: string;
  correlationId: string;
  candidates?: readonly KnowledgeCandidateMetadata[];
  generatedCitations?: readonly KnowledgeGeneratedCitation[];
  snapshotVersion?: string;
}

export interface KnowledgePlatformAuthOptions {
  now?: Date | string | (() => Date);
  maxAgeSeconds?: number;
  expectedSourceVersion?: string;
  policyVersion?: string;
  projectionMaxAgeSeconds?: number;
  revokedSessionIds?: readonly string[] | ReadonlySet<string>;
  auditSink?: (evidence: KnowledgePlatformAuthEvidence) => void;
}

export function evaluateKnowledgePlatformAuth(
  input: KnowledgePlatformAuthInput,
  options: KnowledgePlatformAuthOptions = {},
): KnowledgePlatformAuthDecision {
  const now = optionNow(options);
  const policyVersion = options.policyVersion ?? "platform.entitlements.v1";
  const snapshotVersion = input.snapshotVersion ?? KNOWLEDGE_PLATFORM_SNAPSHOT_VERSION;

  if (input.claimsParseError) {
    return deny("CLAIM_MALFORMED", input, options, now, policyVersion, snapshotVersion);
  }

  if (input.claims === undefined) {
    return deny("PLATFORM_CLAIMS_REQUIRED", input, options, now, policyVersion, snapshotVersion);
  }

  const validation = validatePlatformClaims(input.claims, {
    now,
    maxAgeSeconds: options.maxAgeSeconds,
    expectedSourceVersion: options.expectedSourceVersion,
  });
  if (!validation.valid) {
    return deny(validation.reason, input, options, now, policyVersion, snapshotVersion);
  }

  const claims = validation.claims;
  const snapshot = claimEvidenceSnapshot(claims);
  if (isPlatformSessionRevoked(claims, options.revokedSessionIds)) {
    return deny("PLATFORM_SESSION_REVOKED", input, options, now, policyVersion, snapshotVersion, snapshot);
  }

  const entitlement = evaluateEntitlement(
    claims,
    {
      ...KNOWLEDGE_PLATFORM_ENTITLEMENT_REQUEST,
      serverVerified: input.serverVerified,
    },
    {
      now,
      maxAgeSeconds: options.maxAgeSeconds,
      expectedSourceVersion: options.expectedSourceVersion,
      policyVersion,
    },
  );

  if (!entitlement.allowed) {
    return {
      allowed: false,
      reason: entitlement.reason,
      evidence: evidence(
        input,
        options,
        now,
        policyVersion,
        "DENY",
        entitlement.reason,
        snapshotVersion,
        entitlement.claims_snapshot ?? snapshot,
      ),
      entitlement,
    };
  }

  const candidates = input.candidates ?? syntheticKnowledgeCandidates();
  const decisions = candidates.map((candidate) => abacDecisionToScopeDecision(candidate, input, options, now, claims));
  const scope = buildPreRetrievalScope(candidates, decisions, { snapshotVersion });

  if (scope.allowed_citation_ids.length === 0) {
    return deny("SCOPE_EMPTY", input, options, now, entitlement.policy_version, snapshotVersion, entitlement.claims_snapshot, scope);
  }

  const citations = filterCitations(input.generatedCitations ?? syntheticKnowledgeCitations(), scope);
  if (citations.no_answer) {
    return deny(
      "CITATION_SCOPE_DENIED",
      input,
      options,
      now,
      entitlement.policy_version,
      snapshotVersion,
      entitlement.claims_snapshot,
      scope,
      citations,
    );
  }

  const allowEvidence = evidence(
    input,
    options,
    now,
    entitlement.policy_version,
    "ALLOW",
    "ALLOW",
    snapshotVersion,
    entitlement.claims_snapshot,
    scope,
    citations,
    candidates,
  );
  options.auditSink?.(allowEvidence);
  return {
    allowed: true,
    reason: "ALLOW",
    evidence: allowEvidence,
    entitlement,
    scope,
    citations,
  };
}

export function syntheticKnowledgeCandidates(): KnowledgeCandidateMetadata[] {
  return [
    {
      citation_id: "cit-case-allowed",
      resource_id: "CASE-DOPAMS-001",
      source_system: "dopams",
      source_record_id: "CASE-DOPAMS-001",
      source_version: "dopams-source-v1",
      projection_version: KNOWLEDGE_PLATFORM_PROJECTION_VERSION,
      projected_at: "2026-07-01T18:45:00Z",
      source_status: "active",
      classification: "confidential",
      org_id: "mohali-district",
      unit_id: "narcotics-cell-mohali",
      jurisdiction: {
        country: "IN",
        state: "PB",
        district: "SAS Nagar",
        police_station: "Phase-8",
      },
      assignment: { case_id: "CASE-DOPAMS-001" },
      legal_hold_status: "none",
      redaction_decision: {
        profile: "knowledge-case-summary-v1",
        fields_redacted: ["subject_identifiers", "storage_uri"],
        storage_uri_exposed: false,
        reason: "platform_knowledge_summary",
      },
      snapshot_version: KNOWLEDGE_PLATFORM_SNAPSHOT_VERSION,
      search_backends: ["cache", "vector", "graph", "lexical", "wiki"],
    },
    {
      citation_id: "cit-wrong-jurisdiction",
      resource_id: "CASE-DOPAMS-009",
      source_system: "dopams",
      source_record_id: "CASE-DOPAMS-009",
      source_version: "dopams-source-v1",
      projection_version: KNOWLEDGE_PLATFORM_PROJECTION_VERSION,
      projected_at: "2026-07-01T18:45:00Z",
      source_status: "active",
      classification: "confidential",
      org_id: "mohali-district",
      unit_id: "narcotics-cell-mohali",
      jurisdiction: {
        country: "IN",
        state: "PB",
        district: "Ludhiana",
        police_station: "Division-5",
      },
      assignment: { case_id: "CASE-DOPAMS-009" },
      legal_hold_status: "none",
      redaction_decision: {
        profile: "knowledge-case-summary-v1",
        fields_redacted: ["subject_identifiers", "storage_uri"],
        storage_uri_exposed: false,
        reason: "platform_knowledge_summary",
      },
      snapshot_version: KNOWLEDGE_PLATFORM_SNAPSHOT_VERSION,
      search_backends: ["vector", "graph", "lexical"],
    },
    {
      citation_id: "cit-secret-classification",
      resource_id: "CASE-DOPAMS-001-SECRET",
      source_system: "dopams",
      source_record_id: "CASE-DOPAMS-001-SECRET",
      source_version: "dopams-source-v1",
      projection_version: KNOWLEDGE_PLATFORM_PROJECTION_VERSION,
      projected_at: "2026-07-01T18:45:00Z",
      source_status: "active",
      classification: "secret",
      org_id: "mohali-district",
      unit_id: "narcotics-cell-mohali",
      jurisdiction: {
        country: "IN",
        state: "PB",
        district: "SAS Nagar",
        police_station: "Phase-8",
      },
      assignment: { case_id: "CASE-DOPAMS-001" },
      legal_hold_status: "none",
      redaction_decision: {
        profile: "knowledge-case-summary-v1",
        fields_redacted: ["all_secret_fields", "storage_uri"],
        storage_uri_exposed: false,
        reason: "platform_knowledge_summary",
      },
      snapshot_version: KNOWLEDGE_PLATFORM_SNAPSHOT_VERSION,
      search_backends: ["vector", "graph"],
    },
  ];
}

export function syntheticKnowledgeCitations(): KnowledgeGeneratedCitation[] {
  return [
    { citation_id: "cit-case-allowed", label: "Allowed case summary", excerpt: "Synthetic scoped citation" },
    { citation_id: "cit-secret-classification", label: "Denied classification", excerpt: "Synthetic unauthorized citation" },
    { citation_id: "cit-hallucinated", label: "Hallucinated source", excerpt: "Synthetic hallucinated citation" },
  ];
}

export function knowledgeRetrievalRequestForCandidate(
  candidate: KnowledgeCandidateMetadata,
  input: Pick<KnowledgePlatformAuthInput, "servicePath" | "correlationId" | "serverVerified">,
): AbacRequest {
  return {
    action: "platform.knowledge.retrieve",
    path: input.servicePath,
    correlation_id: input.correlationId,
    module: KNOWLEDGE_PLATFORM_ENTITLEMENT_REQUEST.module,
    domain: KNOWLEDGE_PLATFORM_ENTITLEMENT_REQUEST.domain,
    permission: KNOWLEDGE_PLATFORM_ENTITLEMENT_REQUEST.permission,
    purpose: KNOWLEDGE_PLATFORM_ENTITLEMENT_REQUEST.purpose,
    require_mfa: KNOWLEDGE_PLATFORM_ENTITLEMENT_REQUEST.requireMfa,
    server_verified: input.serverVerified,
    resource: {
      kind: "knowledge_citation",
      resource_id: candidate.citation_id,
      source_system: candidate.source_system,
      source_record_id: candidate.source_record_id,
      source_version: candidate.source_version,
      projection_version: candidate.projection_version,
      projected_at: candidate.projected_at,
      source_status: candidate.source_status,
      classification: candidate.classification,
      org_id: candidate.org_id,
      unit_id: candidate.unit_id,
      jurisdiction: candidate.jurisdiction,
      assignment: candidate.assignment,
      legal_hold_status: candidate.legal_hold_status,
    },
    redaction_decision: candidate.redaction_decision,
  };
}

function abacDecisionToScopeDecision(
  candidate: KnowledgeCandidateMetadata,
  input: KnowledgePlatformAuthInput,
  options: KnowledgePlatformAuthOptions,
  now: Date,
  claims: PlatformClaims,
): KnowledgeScopeDecision {
  const decision = evaluateAbac(claims, knowledgeRetrievalRequestForCandidate(candidate, input), {
    now,
    maxAgeSeconds: options.maxAgeSeconds,
    expectedSourceVersion: options.expectedSourceVersion,
    projectionMaxAgeSeconds: options.projectionMaxAgeSeconds,
    entitlementPolicyVersion: options.policyVersion ?? "platform.entitlements.v1",
    knowledgeRetrievalEnabled: true,
  });

  return {
    citation_id: candidate.citation_id,
    allowed: decision.allowed,
    reason: decision.reason,
    decision_evidence_id: decisionEvidenceId(decision),
  };
}

function deny(
  reason: Exclude<KnowledgePlatformAuthReason, "ALLOW">,
  input: KnowledgePlatformAuthInput,
  options: KnowledgePlatformAuthOptions,
  now: Date,
  policyVersion: string,
  snapshotVersion: string,
  snapshot?: PlatformClaimSnapshot,
  scope?: KnowledgePreRetrievalScope,
  citations?: KnowledgeCitationFilterResult,
): KnowledgePlatformAuthDecision {
  const denyEvidence = evidence(input, options, now, policyVersion, "DENY", reason, snapshotVersion, snapshot, scope, citations);
  options.auditSink?.(denyEvidence);
  return {
    allowed: false,
    reason,
    evidence: denyEvidence,
    ...(scope ? { scope } : {}),
    ...(citations ? { citations } : {}),
  };
}

function evidence(
  input: KnowledgePlatformAuthInput,
  _options: KnowledgePlatformAuthOptions,
  now: Date,
  policyVersion: string,
  outcome: "ALLOW" | "DENY",
  reason: KnowledgePlatformAuthReason,
  snapshotVersion: string,
  snapshot?: PlatformClaimSnapshot,
  scope?: KnowledgePreRetrievalScope,
  citations?: KnowledgeCitationFilterResult,
  candidates: readonly KnowledgeCandidateMetadata[] = input.candidates ?? syntheticKnowledgeCandidates(),
): KnowledgePlatformAuthEvidence {
  return {
    adapter_version: KNOWLEDGE_PLATFORM_AUTH_ADAPTER_VERSION,
    gate_evidence_ref: KNOWLEDGE_PLATFORM_AUTH_GATE_EVIDENCE_REF,
    policy_version: policyVersion,
    service_path: input.servicePath,
    outcome,
    reason,
    correlation_id: input.correlationId,
    source_version: "knowledge-api",
    snapshot_version: snapshotVersion,
    projection_version: projectionVersionForEvidence(scope, candidates),
    redaction_decision: "knowledge-case-summary-v1",
    server_verified: input.serverVerified,
    audited_at: now.toISOString(),
    ...(snapshot ? { claims_snapshot: snapshot } : {}),
    ...(scope ? { scope: scopeEvidence(scope, citations, candidates, snapshotVersion) } : {}),
  };
}

function scopeEvidence(
  scope: KnowledgePreRetrievalScope,
  citations: KnowledgeCitationFilterResult | undefined,
  candidates: readonly KnowledgeCandidateMetadata[],
  snapshotVersion: string,
): KnowledgePlatformScopeEvidence {
  return {
    snapshot_version: snapshotVersion,
    allowed_candidate_count: scope.allowed_citation_ids.length,
    denied_candidate_count: scope.denied_decisions.length,
    retained_citation_count: citations?.retained.length ?? 0,
    dropped_citation_count: citations?.dropped.length ?? 0,
    search_plan: {
      cache: filterCandidatesForSearch(candidates, scope, "cache").map((candidate) => candidate.citation_id),
      vector: filterCandidatesForSearch(candidates, scope, "vector").map((candidate) => candidate.citation_id),
      graph: filterCandidatesForSearch(candidates, scope, "graph").map((candidate) => candidate.citation_id),
      lexical: filterCandidatesForSearch(candidates, scope, "lexical").map((candidate) => candidate.citation_id),
      wiki: filterCandidatesForSearch(candidates, scope, "wiki").map((candidate) => candidate.citation_id),
    },
    pre_retrieval: scope.audit_event,
    ...(citations ? { citation_filter: citations.audit_event } : {}),
  };
}

function projectionVersionForEvidence(
  scope: KnowledgePreRetrievalScope | undefined,
  candidates: readonly KnowledgeCandidateMetadata[],
): string {
  const allowed = scope
    ? candidates.find((candidate) => scope.allowed_citation_ids.includes(candidate.citation_id))
    : candidates[0];
  return allowed?.projection_version ?? "not_applicable";
}

function decisionEvidenceId(decision: AbacDecision): string {
  return [
    decision.decision_evidence.correlation_id,
    decision.decision_evidence.resource.resource_id,
    decision.decision_evidence.reason,
  ].join(":");
}

function isPlatformSessionRevoked(
  claims: PlatformClaims,
  configuredRevokedSessionIds?: readonly string[] | ReadonlySet<string>,
): boolean {
  const revoked = configuredRevokedSessionIds ?? revokedSessionsFromEnv();
  return Array.from(revoked).includes(claims.session_id);
}

function revokedSessionsFromEnv(): readonly string[] {
  return (process.env.KNOWLEDGE_PLATFORM_REVOKED_SESSIONS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function optionNow(options: KnowledgePlatformAuthOptions): Date {
  if (typeof options.now === "function") {
    return options.now();
  }
  return toDate(options.now ?? new Date()) ?? new Date();
}

function toDate(value: Date | string): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
