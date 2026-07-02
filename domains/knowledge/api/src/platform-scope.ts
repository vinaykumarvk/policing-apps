import type {
  ClearanceLevel,
  EntitlementAssignmentRequest,
  EntitlementJurisdictionRequest,
  LegalHoldStatus,
  RedactionDecision,
  SourceRecordStatus,
} from "@policing-platform/authz";

export type KnowledgeSearchBackend = "cache" | "vector" | "graph" | "lexical" | "wiki";

export interface KnowledgeCandidateMetadata {
  citation_id: string;
  resource_id: string;
  source_system: string;
  source_record_id: string;
  source_version: string;
  projection_version: string;
  projected_at: string;
  source_status: SourceRecordStatus;
  classification: ClearanceLevel;
  org_id: string;
  unit_id?: string;
  jurisdiction: EntitlementJurisdictionRequest;
  assignment: EntitlementAssignmentRequest;
  legal_hold_status: LegalHoldStatus;
  redaction_decision: RedactionDecision;
  snapshot_version: string;
  search_backends: readonly KnowledgeSearchBackend[];
}

export interface KnowledgeScopeDecision {
  citation_id: string;
  allowed: boolean;
  reason: string;
  decision_evidence_id: string;
}

export interface KnowledgeScopeAuditEvent {
  event_type: "pre_retrieval_scope" | "citation_filter";
  allowed_citation_ids: readonly string[];
  denied_citation_ids: readonly string[];
  retained_citation_ids: readonly string[];
  dropped_citation_ids: readonly string[];
  reasons: readonly string[];
}

export interface KnowledgePreRetrievalScope {
  allowed_citation_ids: readonly string[];
  denied_decisions: readonly KnowledgeScopeDecision[];
  audit_event: KnowledgeScopeAuditEvent;
}

export interface KnowledgeGeneratedCitation {
  citation_id: string;
  label: string;
  excerpt: string;
  redacted_fields_revealed?: readonly string[];
}

export interface KnowledgeCitationDrop {
  citation: KnowledgeGeneratedCitation;
  reason: "CITATION_SCOPE_DENIED" | "CITATION_REDACTION_DENIED";
}

export interface KnowledgeCitationFilterResult {
  retained: readonly KnowledgeGeneratedCitation[];
  dropped: readonly KnowledgeCitationDrop[];
  no_answer: boolean;
  audit_event: KnowledgeScopeAuditEvent;
}

export interface KnowledgeScopeOptions {
  snapshotVersion?: string;
}

export function buildPreRetrievalScope(
  candidates: readonly KnowledgeCandidateMetadata[],
  decisions: readonly KnowledgeScopeDecision[],
  options: KnowledgeScopeOptions = {},
): KnowledgePreRetrievalScope {
  const decisionsByCitationId = new Map(decisions.map((decision) => [decision.citation_id, decision]));
  const allowedCitationIds: string[] = [];
  const deniedDecisions: KnowledgeScopeDecision[] = [];

  for (const candidate of candidates) {
    const decision = decisionsByCitationId.get(candidate.citation_id);
    const readinessIssue = candidateReadinessIssue(candidate, options);

    if (!decision) {
      deniedDecisions.push({
        citation_id: candidate.citation_id || "missing",
        allowed: false,
        reason: readinessIssue ?? "MISSING_SCOPE_DECISION",
        decision_evidence_id: "missing",
      });
      continue;
    }

    if (readinessIssue) {
      deniedDecisions.push({
        citation_id: candidate.citation_id || "missing",
        allowed: false,
        reason: readinessIssue,
        decision_evidence_id: decision.decision_evidence_id,
      });
      continue;
    }

    if (!decision.allowed) {
      deniedDecisions.push({ ...decision });
      continue;
    }

    allowedCitationIds.push(candidate.citation_id);
  }

  return {
    allowed_citation_ids: allowedCitationIds,
    denied_decisions: deniedDecisions,
    audit_event: {
      event_type: "pre_retrieval_scope",
      allowed_citation_ids: allowedCitationIds,
      denied_citation_ids: deniedDecisions.map((decision) => decision.citation_id),
      retained_citation_ids: [],
      dropped_citation_ids: [],
      reasons: deniedDecisions.map((decision) => decision.reason),
    },
  };
}

export function filterCandidatesForSearch(
  candidates: readonly KnowledgeCandidateMetadata[],
  scope: KnowledgePreRetrievalScope,
  backend: KnowledgeSearchBackend,
): KnowledgeCandidateMetadata[] {
  const allowedCitationIds = new Set(scope.allowed_citation_ids);
  return candidates.filter(
    (candidate) => candidate.search_backends.includes(backend) && allowedCitationIds.has(candidate.citation_id),
  );
}

export function filterCitations(
  citations: readonly KnowledgeGeneratedCitation[],
  scope: KnowledgePreRetrievalScope,
): KnowledgeCitationFilterResult {
  const allowedCitationIds = new Set(scope.allowed_citation_ids);
  const retained: KnowledgeGeneratedCitation[] = [];
  const dropped: KnowledgeCitationDrop[] = [];

  for (const citation of citations) {
    if (!allowedCitationIds.has(citation.citation_id)) {
      dropped.push({ citation, reason: "CITATION_SCOPE_DENIED" });
      continue;
    }

    if (citation.redacted_fields_revealed && citation.redacted_fields_revealed.length > 0) {
      dropped.push({ citation, reason: "CITATION_REDACTION_DENIED" });
      continue;
    }

    retained.push(citation);
  }

  return {
    retained,
    dropped,
    no_answer: retained.length === 0,
    audit_event: {
      event_type: "citation_filter",
      allowed_citation_ids: scope.allowed_citation_ids,
      denied_citation_ids: scope.denied_decisions.map((decision) => decision.citation_id),
      retained_citation_ids: retained.map((citation) => citation.citation_id),
      dropped_citation_ids: dropped.map((drop) => drop.citation.citation_id),
      reasons: dropped.map((drop) => drop.reason),
    },
  };
}

export const filterCitationsForResponse = filterCitations;

function candidateReadinessIssue(candidate: KnowledgeCandidateMetadata, options: KnowledgeScopeOptions): string | null {
  if (!candidate.citation_id.trim()) {
    return "MISSING_CITATION_ID";
  }
  if (candidate.source_status !== "active") {
    return "SOURCE_STATUS_DENIED";
  }
  if (!candidate.source_version.trim() || !candidate.projection_version.trim() || !candidate.projected_at.trim()) {
    return "STALE_PROJECTION";
  }
  if (options.snapshotVersion && candidate.snapshot_version !== options.snapshotVersion) {
    return "SNAPSHOT_VERSION_DENIED";
  }
  if (!candidate.redaction_decision.profile.trim() || !candidate.redaction_decision.reason.trim()) {
    return "REDACTION_DENIED";
  }
  if (candidate.redaction_decision.storage_uri_exposed) {
    return "STORAGE_URI_DENIED";
  }
  return null;
}
