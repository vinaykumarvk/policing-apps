import {
  type DomainPermissionClaim,
  type ClaimValidationOptions,
  type ClaimRejectionReason,
  type ClearanceLevel,
  type PlatformClaimSnapshot,
  claimEvidenceSnapshot,
  clearanceRank,
  validatePlatformClaims,
} from "./claims";
import {
  type EntitlementAssignmentRequest,
  type EntitlementJurisdictionRequest,
  type EntitlementRequest,
  evaluateEntitlement,
} from "./entitlements";

export const ABAC_POLICY_VERSION = "platform.abac.v1";
export const DEFAULT_PROJECTION_MAX_AGE_SECONDS = 5 * 60;

export type AbacAction =
  | "platform.case.read"
  | "platform.evidence.read"
  | "platform.app.launch"
  | "platform.knowledge.retrieve"
  | "platform.decision_evidence.read";

export type PlatformResourceKind =
  | "platform_case"
  | "platform_evidence"
  | "app_route"
  | "knowledge_citation"
  | "decision_evidence";

export type SourceRecordStatus =
  | "active"
  | "deleted"
  | "sealed"
  | "purged"
  | "superseded"
  | "retained_inaccessible"
  | "unknown";

export type LegalHoldStatus = "none" | "active" | "released" | "unknown";

export type AbacDenyReason =
  | "REQUEST_INCOMPLETE"
  | "POLICY_MISSING"
  | "ACTION_RESOURCE_MISMATCH"
  | "ENTITLEMENT_DENIED"
  | "RESOURCE_INCOMPLETE"
  | "SOURCE_STATUS_DENIED"
  | "STALE_PROJECTION"
  | "CLASSIFICATION_DENIED"
  | "LEGAL_HOLD_DENIED"
  | "REDACTION_DENIED"
  | "STORAGE_URI_DENIED"
  | "APP_ROUTE_INACTIVE"
  | "KNOWLEDGE_RETRIEVAL_DISABLED";

export interface RedactionDecision {
  profile: string;
  fields_redacted: string[];
  storage_uri_exposed: boolean;
  reason: string;
}

export interface AbacResourceContext {
  kind: PlatformResourceKind;
  resource_id: string;
  source_system: string;
  source_record_id: string;
  source_version?: string | null;
  projection_version?: string | null;
  projected_at?: string | null;
  source_status: SourceRecordStatus;
  classification: ClearanceLevel;
  org_id: string;
  unit_id?: string;
  jurisdiction: EntitlementJurisdictionRequest;
  assignment: EntitlementAssignmentRequest;
  legal_hold_status: LegalHoldStatus;
}

export interface AbacRequest {
  action: AbacAction;
  path: string;
  correlation_id: string;
  module: string;
  domain: string;
  permission: string;
  purpose: string;
  require_mfa: boolean;
  server_verified: boolean;
  resource: AbacResourceContext;
  redaction_decision?: RedactionDecision | null;
}

export interface AbacOptions extends ClaimValidationOptions {
  policyVersion?: string | null;
  entitlementPolicyVersion?: string;
  projectionMaxAgeSeconds?: number;
  appRegistryRoutesActive?: boolean;
  knowledgeRetrievalEnabled?: boolean;
}

export interface ValidClaimDecisionSnapshot extends PlatformClaimSnapshot {
  validation: "valid";
  validation_reason: "ALLOW";
  validation_issues: [];
}

export interface InvalidClaimDecisionSnapshot {
  validation: "invalid";
  validation_reason: ClaimRejectionReason;
  validation_issues: string[];
  schema_version: string | null;
  claim_version: number | null;
  source_version: string | null;
  subject_id: string | null;
  persona: string | null;
  session_id: string | null;
  modules: string[];
  domain_permissions: DomainPermissionClaim[];
  mfa_verified: boolean | null;
  expires_at: string | null;
}

export type AbacClaimDecisionSnapshot = ValidClaimDecisionSnapshot | InvalidClaimDecisionSnapshot;

export interface AbacDecisionResourceEvidence {
  kind: PlatformResourceKind | "missing";
  resource_id: string;
  source_system: string;
  source_record_id: string;
  source_version: string;
  projection_version: string;
  source_status: SourceRecordStatus | "missing";
  classification: ClearanceLevel | "missing";
  legal_hold_status: LegalHoldStatus | "missing";
}

export interface AbacDecisionInputs {
  server_verified: boolean;
  claim_valid: boolean;
  policy_present: boolean;
  resource_complete: boolean;
  projection_fresh: boolean;
  source_active: boolean;
  redaction_complete: boolean;
  storage_uri_exposed: boolean;
  legal_hold_checked: boolean;
  jurisdiction_checked: boolean;
  assignment_checked: boolean;
  clearance_checked: boolean;
  purpose_checked: boolean;
  mfa_checked: boolean;
}

export interface AbacDecisionEvidence {
  policy_version: string;
  entitlement_policy_version: string;
  path: string;
  action: AbacAction | "missing";
  correlation_id: string;
  outcome: "allow" | "deny";
  reason: "ALLOW" | AbacDenyReason;
  detail: string;
  claims_snapshot: AbacClaimDecisionSnapshot;
  resource: AbacDecisionResourceEvidence;
  redaction_decision: RedactionDecision;
  decision_inputs: AbacDecisionInputs;
}

export type AbacDecision =
  | {
      allowed: true;
      reason: "ALLOW";
      policy_version: string;
      entitlement_policy_version: string;
      claims_snapshot: ValidClaimDecisionSnapshot;
      redaction_decision: RedactionDecision;
      decision_evidence: AbacDecisionEvidence;
    }
  | {
      allowed: false;
      reason: AbacDenyReason;
      detail: string;
      policy_version: string;
      entitlement_policy_version: string;
      claims_snapshot: AbacClaimDecisionSnapshot;
      redaction_decision: RedactionDecision;
      decision_evidence: AbacDecisionEvidence;
    };

const ACTION_RESOURCE_KIND: Record<AbacAction, PlatformResourceKind> = {
  "platform.case.read": "platform_case",
  "platform.evidence.read": "platform_evidence",
  "platform.app.launch": "app_route",
  "platform.knowledge.retrieve": "knowledge_citation",
  "platform.decision_evidence.read": "decision_evidence",
};

const SAFE_DENY_REDACTION: RedactionDecision = {
  profile: "deny-none",
  fields_redacted: ["all"],
  storage_uri_exposed: false,
  reason: "deny_no_data_returned",
};

const LEGAL_HOLD_PURPOSES = new Set(["legal_review", "court_preparation", "audit"]);

export function evaluateAbac(claimInput: unknown, request: AbacRequest, options: AbacOptions = {}): AbacDecision {
  const policyVersion = options.policyVersion ?? ABAC_POLICY_VERSION;
  const entitlementPolicyVersion = options.entitlementPolicyVersion ?? "platform.entitlements.v1";
  const claimsSnapshot = claimSnapshotForDecision(claimInput, options);
  const redactionState = redactionForDecision(request?.redaction_decision);
  const base = {
    policyVersion: isNonEmptyString(policyVersion) ? policyVersion : "missing",
    entitlementPolicyVersion,
    claimsSnapshot,
    redactionDecision: redactionState.decision,
    options,
  };

  if (!isNonEmptyString(policyVersion)) {
    return deny(base, request, "POLICY_MISSING", "policy version is required");
  }

  const requestIssue = requestCompletenessIssue(request);
  if (requestIssue) {
    return deny(base, request, "REQUEST_INCOMPLETE", requestIssue);
  }

  const actionKind = ACTION_RESOURCE_KIND[request.action];
  if (request.resource.kind !== actionKind) {
    return deny(base, request, "ACTION_RESOURCE_MISMATCH", `${request.action} requires ${actionKind}`);
  }

  if (request.action === "platform.knowledge.retrieve" && !options.knowledgeRetrievalEnabled) {
    return deny(base, request, "KNOWLEDGE_RETRIEVAL_DISABLED", "knowledge retrieval remains disabled until scoped retrieval is proven");
  }

  if (request.action === "platform.app.launch" && !options.appRegistryRoutesActive) {
    return deny(base, request, "APP_ROUTE_INACTIVE", "app registry routes are not active in this phase");
  }

  const resourceIssue = resourceCompletenessIssue(request.resource);
  if (resourceIssue) {
    return deny(base, request, "RESOURCE_INCOMPLETE", resourceIssue);
  }

  if (request.resource.source_status !== "active") {
    return deny(base, request, "SOURCE_STATUS_DENIED", `source status ${request.resource.source_status} is not readable`);
  }

  const projectionIssue = projectionFreshnessIssue(request.resource, options);
  if (projectionIssue) {
    return deny(base, request, "STALE_PROJECTION", projectionIssue);
  }

  if (!redactionState.complete) {
    return deny(base, request, "REDACTION_DENIED", redactionState.detail);
  }

  if (
    (request.resource.kind === "platform_evidence" || request.resource.kind === "knowledge_citation") &&
    redactionState.decision.storage_uri_exposed
  ) {
    const detail =
      request.resource.kind === "knowledge_citation"
        ? "knowledge citation responses do not expose storage_uri"
        : "central evidence APIs do not expose storage_uri by default";
    return deny(
      { ...base, redactionDecision: { ...SAFE_DENY_REDACTION, fields_redacted: ["storage_uri"], reason: "storage_uri_excluded" } },
      request,
      "STORAGE_URI_DENIED",
      detail,
    );
  }

  const entitlementRequest = entitlementRequestFromAbac(request);
  const entitlement = evaluateEntitlement(claimInput, entitlementRequest, {
    ...options,
    policyVersion: entitlementPolicyVersion,
  });

  if (!entitlement.allowed) {
    const snapshot = entitlement.claims_snapshot
      ? validClaimSnapshot(entitlement.claims_snapshot)
      : claimsSnapshot;
    return deny({ ...base, claimsSnapshot: snapshot }, request, "ENTITLEMENT_DENIED", entitlement.reason);
  }

  const validSnapshot = validClaimSnapshot(entitlement.claims_snapshot);
  if (clearanceRank(validSnapshot.clearance.level) < clearanceRank(request.resource.classification)) {
    return deny(
      { ...base, claimsSnapshot: validSnapshot },
      request,
      "CLASSIFICATION_DENIED",
      `claim clearance ${validSnapshot.clearance.level} is below ${request.resource.classification}`,
    );
  }

  if (request.resource.legal_hold_status === "active" && !LEGAL_HOLD_PURPOSES.has(request.purpose)) {
    return deny(
      { ...base, claimsSnapshot: validSnapshot },
      request,
      "LEGAL_HOLD_DENIED",
      `purpose ${request.purpose} is not valid for active legal hold`,
    );
  }

  return allow({ ...base, claimsSnapshot: validSnapshot }, request);
}

function allow(
  base: EvidenceBase & { claimsSnapshot: ValidClaimDecisionSnapshot },
  request: AbacRequest,
): AbacDecision {
  const decisionEvidence = evidence(base, request, "allow", "ALLOW", "allowed");
  return {
    allowed: true,
    reason: "ALLOW",
    policy_version: base.policyVersion,
    entitlement_policy_version: base.entitlementPolicyVersion,
    claims_snapshot: base.claimsSnapshot,
    redaction_decision: base.redactionDecision,
    decision_evidence: decisionEvidence,
  };
}

function deny(
  base: EvidenceBase,
  request: Partial<AbacRequest> | undefined,
  reason: AbacDenyReason,
  detail: string,
): AbacDecision {
  const decisionEvidence = evidence(base, request, "deny", reason, detail);
  return {
    allowed: false,
    reason,
    detail,
    policy_version: base.policyVersion,
    entitlement_policy_version: base.entitlementPolicyVersion,
    claims_snapshot: base.claimsSnapshot,
    redaction_decision: base.redactionDecision,
    decision_evidence: decisionEvidence,
  };
}

interface EvidenceBase {
  policyVersion: string;
  entitlementPolicyVersion: string;
  claimsSnapshot: AbacClaimDecisionSnapshot;
  redactionDecision: RedactionDecision;
  options: AbacOptions;
}

function evidence(
  base: EvidenceBase,
  request: Partial<AbacRequest> | undefined,
  outcome: "allow" | "deny",
  reason: "ALLOW" | AbacDenyReason,
  detail: string,
): AbacDecisionEvidence {
  return {
    policy_version: base.policyVersion,
    entitlement_policy_version: base.entitlementPolicyVersion,
    path: isNonEmptyString(request?.path) ? request.path : "missing",
    action: isAbacAction(request?.action) ? request.action : "missing",
    correlation_id: isNonEmptyString(request?.correlation_id) ? request.correlation_id : "missing",
    outcome,
    reason,
    detail,
    claims_snapshot: base.claimsSnapshot,
    resource: resourceEvidence(request?.resource),
    redaction_decision: base.redactionDecision,
    decision_inputs: decisionInputs(base, request),
  };
}

function decisionInputs(base: EvidenceBase, request: Partial<AbacRequest> | undefined): AbacDecisionInputs {
  const resource = request?.resource;
  const projectionFresh = resource ? projectionFreshnessIssue(resource, base.options) === null : false;
  const sourceActive = resource?.source_status === "active";
  const redaction = redactionForDecision(request?.redaction_decision);
  return {
    server_verified: request?.server_verified === true,
    claim_valid: base.claimsSnapshot.validation === "valid",
    policy_present: base.policyVersion !== "missing",
    resource_complete: resource ? resourceCompletenessIssue(resource) === null : false,
    projection_fresh: projectionFresh,
    source_active: sourceActive,
    redaction_complete: redaction.complete,
    storage_uri_exposed: redaction.decision.storage_uri_exposed,
    legal_hold_checked: resource?.legal_hold_status !== undefined && resource.legal_hold_status !== "unknown",
    jurisdiction_checked: Boolean(resource?.jurisdiction),
    assignment_checked: Boolean(resource?.assignment),
    clearance_checked: Boolean(resource?.classification),
    purpose_checked: isNonEmptyString(request?.purpose),
    mfa_checked: typeof request?.require_mfa === "boolean",
  };
}

function entitlementRequestFromAbac(request: AbacRequest): EntitlementRequest {
  return {
    module: request.module,
    domain: request.domain,
    permission: request.permission,
    org_id: request.resource.org_id,
    unit_id: request.resource.unit_id,
    jurisdiction: request.resource.jurisdiction,
    requiredClearance: request.resource.classification,
    assignment: request.resource.assignment,
    purpose: request.purpose,
    requireMfa: request.require_mfa,
    serverVerified: request.server_verified,
  };
}

function requestCompletenessIssue(request: AbacRequest | undefined): string | null {
  if (!request) {
    return "request is required";
  }
  if (!isAbacAction(request.action)) {
    return "supported action is required";
  }
  const requiredStrings: Array<[string, unknown]> = [
    ["path", request.path],
    ["correlation_id", request.correlation_id],
    ["module", request.module],
    ["domain", request.domain],
    ["permission", request.permission],
    ["purpose", request.purpose],
  ];
  const missing = requiredStrings.find(([, value]) => !isNonEmptyString(value));
  if (missing) {
    return `${missing[0]} is required`;
  }
  if (typeof request.require_mfa !== "boolean") {
    return "require_mfa must be a boolean";
  }
  if (typeof request.server_verified !== "boolean") {
    return "server_verified must be a boolean";
  }
  if (!request.resource) {
    return "resource is required";
  }
  return null;
}

function resourceCompletenessIssue(resource: AbacResourceContext): string | null {
  const requiredStrings: Array<[string, unknown]> = [
    ["resource_id", resource.resource_id],
    ["source_system", resource.source_system],
    ["source_record_id", resource.source_record_id],
    ["source_version", resource.source_version],
    ["projection_version", resource.projection_version],
    ["projected_at", resource.projected_at],
    ["org_id", resource.org_id],
  ];
  const missing = requiredStrings.find(([, value]) => !isNonEmptyString(value));
  if (missing) {
    return `${missing[0]} is required`;
  }
  if (!isResourceKind(resource.kind)) {
    return "resource kind is unsupported";
  }
  if (!isSourceStatus(resource.source_status) || resource.source_status === "unknown") {
    return "source_status is required";
  }
  if (!isClearanceLevel(resource.classification)) {
    return "classification is required";
  }
  if (!isLegalHoldStatus(resource.legal_hold_status) || resource.legal_hold_status === "unknown") {
    return "legal_hold_status is required";
  }
  if (!resource.jurisdiction) {
    return "jurisdiction is required";
  }
  if (!resource.assignment) {
    return "assignment is required";
  }
  return null;
}

function projectionFreshnessIssue(resource: AbacResourceContext, options: AbacOptions): string | null {
  if (!isNonEmptyString(resource.projected_at)) {
    return "projected_at is required";
  }
  const projectedAt = new Date(resource.projected_at);
  const now = toDate(options.now ?? new Date());
  if (Number.isNaN(projectedAt.getTime()) || !now) {
    return "projected_at or now is not a valid timestamp";
  }
  if (projectedAt.getTime() > now.getTime()) {
    return "projection timestamp is in the future";
  }
  const maxAgeMs = (options.projectionMaxAgeSeconds ?? DEFAULT_PROJECTION_MAX_AGE_SECONDS) * 1000;
  if (now.getTime() - projectedAt.getTime() > maxAgeMs) {
    return "projection is older than projectionMaxAgeSeconds";
  }
  return null;
}

function redactionForDecision(value: RedactionDecision | null | undefined): {
  complete: boolean;
  detail: string;
  decision: RedactionDecision;
} {
  if (!value) {
    return { complete: false, detail: "redaction decision is required", decision: SAFE_DENY_REDACTION };
  }
  if (!isNonEmptyString(value.profile)) {
    return { complete: false, detail: "redaction profile is required", decision: SAFE_DENY_REDACTION };
  }
  if (!Array.isArray(value.fields_redacted) || !value.fields_redacted.every(isNonEmptyString)) {
    return { complete: false, detail: "fields_redacted must be an array of strings", decision: SAFE_DENY_REDACTION };
  }
  if (typeof value.storage_uri_exposed !== "boolean") {
    return { complete: false, detail: "storage_uri_exposed must be a boolean", decision: SAFE_DENY_REDACTION };
  }
  if (!isNonEmptyString(value.reason)) {
    return { complete: false, detail: "redaction reason is required", decision: SAFE_DENY_REDACTION };
  }
  return { complete: true, detail: "complete", decision: { ...value, fields_redacted: [...value.fields_redacted] } };
}

function claimSnapshotForDecision(input: unknown, options: ClaimValidationOptions): AbacClaimDecisionSnapshot {
  const validation = validatePlatformClaims(input, options);
  if (validation.valid) {
    return validClaimSnapshot(claimEvidenceSnapshot(validation.claims));
  }

  return {
    validation: "invalid",
    validation_reason: validation.reason,
    validation_issues: [...validation.issues],
    schema_version: readString(input, ["schema_version"]),
    claim_version: readNumber(input, ["claim_version"]),
    source_version: readString(input, ["source_version"]),
    subject_id: readString(input, ["subject", "user_id"]),
    persona: readString(input, ["subject", "persona"]),
    session_id: readString(input, ["session_id"]),
    modules: readStringArray(input, ["modules"]),
    domain_permissions: readDomainPermissions(input),
    mfa_verified: readBoolean(input, ["mfa", "verified"]),
    expires_at: readString(input, ["expires_at"]),
  };
}

function validClaimSnapshot(snapshot: PlatformClaimSnapshot): ValidClaimDecisionSnapshot {
  return {
    validation: "valid",
    validation_reason: "ALLOW",
    validation_issues: [],
    ...snapshot,
    modules: [...snapshot.modules],
    domain_permissions: snapshot.domain_permissions.map((entry) => ({
      domain: entry.domain,
      permissions: [...entry.permissions],
    })),
    org: { ...snapshot.org, unit_ids: [...snapshot.org.unit_ids] },
    jurisdiction: {
      ...snapshot.jurisdiction,
      districts: [...snapshot.jurisdiction.districts],
      police_stations: [...snapshot.jurisdiction.police_stations],
    },
    clearance: { ...snapshot.clearance, compartments: [...snapshot.clearance.compartments] },
    assignment: {
      case_ids: [...snapshot.assignment.case_ids],
      queue_ids: [...snapshot.assignment.queue_ids],
      evidence_ids: [...snapshot.assignment.evidence_ids],
      jurisdiction_wide: snapshot.assignment.jurisdiction_wide,
      domain_wide: snapshot.assignment.domain_wide,
    },
    purpose: { allowed: [...snapshot.purpose.allowed] },
  };
}

function resourceEvidence(resource: AbacResourceContext | undefined): AbacDecisionResourceEvidence {
  return {
    kind: resource?.kind ?? "missing",
    resource_id: isNonEmptyString(resource?.resource_id) ? resource.resource_id : "missing",
    source_system: isNonEmptyString(resource?.source_system) ? resource.source_system : "missing",
    source_record_id: isNonEmptyString(resource?.source_record_id) ? resource.source_record_id : "missing",
    source_version: isNonEmptyString(resource?.source_version) ? resource.source_version : "missing",
    projection_version: isNonEmptyString(resource?.projection_version) ? resource.projection_version : "missing",
    source_status: resource?.source_status ?? "missing",
    classification: resource?.classification ?? "missing",
    legal_hold_status: resource?.legal_hold_status ?? "missing",
  };
}

function readDomainPermissions(input: unknown): DomainPermissionClaim[] {
  const value = readPath(input, ["domain_permissions"]);
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }
    const domain = readString(entry, ["domain"]);
    const permissions = readStringArray(entry, ["permissions"]);
    return domain ? [{ domain, permissions }] : [];
  });
}

function readString(input: unknown, path: string[]): string | null {
  const value = readPath(input, path);
  return isNonEmptyString(value) ? value : null;
}

function readNumber(input: unknown, path: string[]): number | null {
  const value = readPath(input, path);
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readBoolean(input: unknown, path: string[]): boolean | null {
  const value = readPath(input, path);
  return typeof value === "boolean" ? value : null;
}

function readStringArray(input: unknown, path: string[]): string[] {
  const value = readPath(input, path);
  return Array.isArray(value) && value.every(isNonEmptyString) ? [...value] : [];
}

function readPath(input: unknown, path: string[]): unknown {
  let value = input;
  for (const segment of path) {
    if (!isRecord(value)) {
      return undefined;
    }
    value = value[segment];
  }
  return value;
}

function isAbacAction(value: unknown): value is AbacAction {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(ACTION_RESOURCE_KIND, value);
}

function isResourceKind(value: unknown): value is PlatformResourceKind {
  return (
    value === "platform_case" ||
    value === "platform_evidence" ||
    value === "app_route" ||
    value === "knowledge_citation" ||
    value === "decision_evidence"
  );
}

function isSourceStatus(value: unknown): value is SourceRecordStatus {
  return (
    value === "active" ||
    value === "deleted" ||
    value === "sealed" ||
    value === "purged" ||
    value === "superseded" ||
    value === "retained_inaccessible" ||
    value === "unknown"
  );
}

function isLegalHoldStatus(value: unknown): value is LegalHoldStatus {
  return value === "none" || value === "active" || value === "released" || value === "unknown";
}

function isClearanceLevel(value: unknown): value is ClearanceLevel {
  return value === "public" || value === "restricted" || value === "confidential" || value === "secret";
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toDate(value: Date | string): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
