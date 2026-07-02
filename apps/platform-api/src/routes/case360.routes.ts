import { randomUUID } from "node:crypto";
import type { AbacDecision } from "../../../../packages/authz/src";
import {
  type AuthorizationDecisionEvidence,
  createAuthorizationDecisionEvidence,
} from "../../../../packages/audit-ledger/src";
import type { DecisionEvidenceSink } from "./platform.routes";
import {
  DEFAULT_CASE360_PURPOSE,
  type CaseProjectionReadInput,
  type CaseProjectionReadResult,
  type CaseProjectionService,
} from "../services/case-projection";
import {
  type EvidenceProjectionReadInput,
  type EvidenceProjectionReadResult,
  type EvidenceProjectionService,
} from "../services/evidence-projection";

export interface Case360RouteContext {
  caseProjectionService: CaseProjectionService;
  evidenceProjectionService: EvidenceProjectionService;
  evidenceSink: DecisionEvidenceSink;
  now: () => Date;
  expectedSourceVersion?: string;
}

export interface DecisionEvidenceSummary {
  decision_id: string;
  outcome: "allow" | "deny";
  reason: string;
  correlation_id: string;
  action: string;
  path: string;
  resource: {
    kind: string;
    resource_id: string;
  };
  integrity: {
    algorithm: "sha256";
    payload_hash: string;
  };
}

export interface DegradedProjectionSummary {
  resource_kind: "platform_case" | "platform_evidence";
  resource_id: string;
  status: "denied" | "missing";
  reason: string;
  detail?: string;
  decision_evidence_id: string;
}

interface Case360SuccessResponse {
  case360_version: "platform.case360.v1";
  case_id: string;
  correlation_id: string;
  purpose: string;
  primary_case: object;
  linked_cases: object[];
  evidence: object[];
  degraded: DegradedProjectionSummary[];
  decision_evidence: DecisionEvidenceSummary[];
}

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

const CASE360_PATH_PATTERN = /^\/api\/v1\/platform\/cases\/([^/]+)\/case360$/;

export function case360CaseId(pathname: string): string | null {
  const match = CASE360_PATH_PATTERN.exec(pathname);
  if (!match?.[1]) {
    return null;
  }
  return decodeURIComponent(match[1]);
}

export async function handleCase360Route(request: Request, context: Case360RouteContext): Promise<Response> {
  const url = new URL(request.url);
  const caseId = case360CaseId(url.pathname);
  if (!caseId) {
    return jsonResponse({ error: { code: "NOT_FOUND", message: "route not found" } }, 404);
  }

  const correlationId = request.headers.get("x-correlation-id") ?? `corr-${randomUUID()}`;
  const purpose = url.searchParams.get("purpose")?.trim() || DEFAULT_CASE360_PURPOSE;
  const baseInput = projectionReadInput(request, context, correlationId, purpose);
  const decisionSummaries: DecisionEvidenceSummary[] = [];
  const degraded: DegradedProjectionSummary[] = [];

  const primaryRead = context.caseProjectionService.readCase(caseId, {
    ...baseInput,
    path: `/api/v1/platform/cases/${caseId}`,
  });
  const primaryEvidence = await appendDecisionEvidence(primaryRead.decision, context);
  decisionSummaries.push(primaryEvidence);

  if (primaryRead.status !== "allowed") {
    return jsonResponse(
      {
        error: {
          code: primaryRead.status === "missing" ? "CASE_PROJECTION_MISSING" : "CASE360_DENIED",
          message: "case projection read denied",
          reason: primaryRead.decision.reason,
          detail: decisionDetail(primaryRead.decision),
        },
        decision_evidence: primaryEvidence,
      },
      primaryRead.status === "missing" ? 404 : 403,
    );
  }

  const linkedReads = context.caseProjectionService
    .listCaseIdsFor360(caseId)
    .filter((linkedCaseId) => linkedCaseId !== caseId)
    .map((linkedCaseId) =>
      context.caseProjectionService.readCase(linkedCaseId, {
        ...baseInput,
        path: `/api/v1/platform/cases/${linkedCaseId}`,
      }),
    );

  const linkedCases: object[] = [];
  const allowedCaseIds = [primaryRead.case_id];
  for (const linkedRead of linkedReads) {
    const evidence = await appendDecisionEvidence(linkedRead.decision, context);
    decisionSummaries.push(evidence);
    if (linkedRead.status === "allowed") {
      linkedCases.push(linkedRead.read_model);
      allowedCaseIds.push(linkedRead.case_id);
    } else {
      degraded.push(degradedCase(linkedRead, evidence));
    }
  }

  const evidenceReads = context.evidenceProjectionService
    .listEvidenceForCases(allowedCaseIds)
    .map((record) =>
      context.evidenceProjectionService.readEvidence(record.projection.evidence_id, {
        ...baseInput,
        path: `/api/v1/platform/evidence/${record.projection.evidence_id}`,
      }),
    );

  const evidenceModels: object[] = [];
  for (const evidenceRead of evidenceReads) {
    const evidence = await appendDecisionEvidence(evidenceRead.decision, context);
    decisionSummaries.push(evidence);
    if (evidenceRead.status === "allowed") {
      evidenceModels.push(evidenceRead.read_model);
    } else {
      degraded.push(degradedEvidence(evidenceRead, evidence));
    }
  }

  const body: Case360SuccessResponse = {
    case360_version: "platform.case360.v1",
    case_id: caseId,
    correlation_id: correlationId,
    purpose,
    primary_case: primaryRead.read_model,
    linked_cases: linkedCases,
    evidence: evidenceModels,
    degraded,
    decision_evidence: decisionSummaries,
  };
  return jsonResponse(body, 200);
}

function projectionReadInput(
  request: Request,
  context: Case360RouteContext,
  correlationId: string,
  purpose: string,
): CaseProjectionReadInput & EvidenceProjectionReadInput {
  return {
    claimInput: claimInputFromHeaders(request.headers),
    serverVerified: request.headers.get("x-platform-claims-verified") === "true",
    correlationId,
    now: context.now(),
    expectedSourceVersion: context.expectedSourceVersion,
    purpose,
  };
}

async function appendDecisionEvidence(
  decision: AbacDecision,
  context: Case360RouteContext,
): Promise<DecisionEvidenceSummary> {
  const evidence = authorizationDecisionEvidence(decision, context.now());
  await context.evidenceSink.append(evidence);
  return evidenceSummary(evidence);
}

function authorizationDecisionEvidence(
  decision: AbacDecision,
  occurredAt: Date,
): Readonly<AuthorizationDecisionEvidence> {
  const decisionEvidence = decision.decision_evidence;
  return createAuthorizationDecisionEvidence({
    occurred_at: occurredAt.toISOString(),
    correlation_id: decisionEvidence.correlation_id,
    outcome: decisionEvidence.outcome,
    reason: decisionEvidence.reason,
    detail: decisionEvidence.detail,
    policy_version: decisionEvidence.policy_version,
    entitlement_policy_version: decisionEvidence.entitlement_policy_version,
    path: decisionEvidence.path,
    action: decisionEvidence.action,
    claims_snapshot: decisionEvidence.claims_snapshot,
    resource: decisionEvidence.resource,
    redaction_decision: decisionEvidence.redaction_decision,
    decision_inputs: decisionEvidence.decision_inputs,
  });
}

function evidenceSummary(evidence: Readonly<AuthorizationDecisionEvidence>): DecisionEvidenceSummary {
  return {
    decision_id: evidence.decision_id,
    outcome: evidence.outcome,
    reason: evidence.reason,
    correlation_id: evidence.correlation_id,
    action: evidence.action,
    path: evidence.path,
    resource: {
      kind: evidence.resource.kind,
      resource_id: evidence.resource.resource_id,
    },
    integrity: evidence.integrity,
  };
}

function degradedCase(
  read: Exclude<CaseProjectionReadResult, { status: "allowed" }>,
  evidence: DecisionEvidenceSummary,
): DegradedProjectionSummary {
  return {
    resource_kind: "platform_case",
    resource_id: read.case_id,
    status: read.status,
    reason: read.decision.reason,
    detail: decisionDetail(read.decision),
    decision_evidence_id: evidence.decision_id,
  };
}

function degradedEvidence(
  read: Exclude<EvidenceProjectionReadResult, { status: "allowed" }>,
  evidence: DecisionEvidenceSummary,
): DegradedProjectionSummary {
  return {
    resource_kind: "platform_evidence",
    resource_id: read.evidence_id,
    status: read.status,
    reason: read.decision.reason,
    detail: decisionDetail(read.decision),
    decision_evidence_id: evidence.decision_id,
  };
}

function decisionDetail(decision: AbacDecision): string | undefined {
  return decision.allowed ? undefined : decision.detail;
}

function claimInputFromHeaders(headers: Headers): unknown {
  const raw = headers.get("x-platform-claims");
  if (!raw) {
    return undefined;
  }
  const jsonParsed = parseJson(raw);
  if (jsonParsed.parsed) {
    return jsonParsed.value;
  }
  const decoded = decodeBase64Url(raw);
  if (!decoded) {
    return undefined;
  }
  const decodedParsed = parseJson(decoded);
  return decodedParsed.parsed ? decodedParsed.value : undefined;
}

function parseJson(raw: string): { parsed: true; value: unknown } | { parsed: false } {
  try {
    return { parsed: true, value: JSON.parse(raw) };
  } catch (_error: unknown) {
    return { parsed: false };
  }
}

function decodeBase64Url(raw: string): string | null {
  try {
    const normalized = raw.replace(/-/g, "+").replace(/_/g, "/");
    return Buffer.from(normalized, "base64").toString("utf8");
  } catch (_error: unknown) {
    return null;
  }
}

function jsonResponse(body: object, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}
