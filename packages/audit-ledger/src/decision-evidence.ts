import { createHash } from "node:crypto";

export const AUTHORIZATION_DECISION_EVIDENCE_SCHEMA_VERSION = "platform.authorization_decision_evidence.v1";

export type AuthorizationOutcome = "allow" | "deny";

export interface DecisionEvidenceResource {
  kind: string;
  resource_id: string;
  source_system: string;
  source_record_id: string;
  source_version: string;
  projection_version: string;
  source_status: string;
  classification: string;
  legal_hold_status: string;
}

export interface DecisionEvidenceRedaction {
  profile: string;
  fields_redacted: string[];
  storage_uri_exposed: boolean;
  reason: string;
}

export interface DecisionEvidenceInputs {
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

export interface DecisionEvidenceRetrieval {
  retrieval_path: string;
  candidate_source_ids: string[];
  citation_ids: string[];
}

export interface AuthorizationDecisionEvidenceInput {
  decision_id?: string;
  occurred_at: string;
  correlation_id: string;
  outcome: AuthorizationOutcome;
  reason: string;
  detail?: string;
  policy_version: string;
  entitlement_policy_version: string;
  path: string;
  action: string;
  claims_snapshot: object;
  resource: DecisionEvidenceResource;
  redaction_decision: DecisionEvidenceRedaction;
  decision_inputs: DecisionEvidenceInputs;
  retrieval?: DecisionEvidenceRetrieval;
}

export interface AuthorizationDecisionEvidence extends AuthorizationDecisionEvidenceInput {
  decision_id: string;
  evidence_schema_version: typeof AUTHORIZATION_DECISION_EVIDENCE_SCHEMA_VERSION;
  integrity: {
    algorithm: "sha256";
    payload_hash: string;
  };
}

export interface DecisionEvidenceValidationResult {
  valid: boolean;
  issues: string[];
}

export class DecisionEvidenceValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`authorization decision evidence is invalid: ${issues.join("; ")}`);
    this.name = "DecisionEvidenceValidationError";
    this.issues = [...issues];
  }
}

export function createAuthorizationDecisionEvidence(
  input: AuthorizationDecisionEvidenceInput,
): Readonly<AuthorizationDecisionEvidence> {
  const issues = validateAuthorizationDecisionEvidenceInput(input).issues;
  if (issues.length > 0) {
    throw new DecisionEvidenceValidationError(issues);
  }

  const payloadWithoutIntegrity: Omit<AuthorizationDecisionEvidence, "integrity"> = {
    ...input,
    decision_id: isNonEmptyString(input.decision_id) ? input.decision_id : decisionId(input),
    evidence_schema_version: AUTHORIZATION_DECISION_EVIDENCE_SCHEMA_VERSION,
    resource: { ...input.resource },
    redaction_decision: {
      ...input.redaction_decision,
      fields_redacted: [...input.redaction_decision.fields_redacted],
    },
    decision_inputs: { ...input.decision_inputs },
    retrieval: input.retrieval
      ? {
          retrieval_path: input.retrieval.retrieval_path,
          candidate_source_ids: [...input.retrieval.candidate_source_ids],
          citation_ids: [...input.retrieval.citation_ids],
        }
      : undefined,
  };

  const evidence: AuthorizationDecisionEvidence = {
    ...payloadWithoutIntegrity,
    integrity: {
      algorithm: "sha256",
      payload_hash: sha256(canonicalize(payloadWithoutIntegrity)),
    },
  };

  return deepFreeze(evidence);
}

export function validateAuthorizationDecisionEvidenceInput(
  input: AuthorizationDecisionEvidenceInput,
): DecisionEvidenceValidationResult {
  const issues: string[] = [];
  if (!isRecord(input)) {
    return { valid: false, issues: ["input must be an object"] };
  }

  requireIsoTimestamp(input.occurred_at, "occurred_at", issues);
  requireString(input.correlation_id, "correlation_id", issues);
  if (input.outcome !== "allow" && input.outcome !== "deny") {
    issues.push("outcome must be allow or deny");
  }
  requireString(input.reason, "reason", issues);
  requireString(input.policy_version, "policy_version", issues);
  requireString(input.entitlement_policy_version, "entitlement_policy_version", issues);
  requireString(input.path, "path", issues);
  requireString(input.action, "action", issues);

  if (!isRecord(input.claims_snapshot)) {
    issues.push("claims_snapshot must be an object");
  } else if (!isSerializable(input.claims_snapshot)) {
    issues.push("claims_snapshot must be JSON-serializable");
  }

  validateResource(input.resource, issues);
  validateRedaction(input.redaction_decision, input.resource?.kind, issues);
  validateDecisionInputs(input.decision_inputs, issues);
  validateRetrieval(input.retrieval, issues);

  if (input.outcome === "allow") {
    if (input.decision_inputs?.claim_valid !== true) {
      issues.push("allow evidence requires claim_valid true");
    }
    if (input.decision_inputs?.resource_complete !== true) {
      issues.push("allow evidence requires resource_complete true");
    }
    if (input.decision_inputs?.projection_fresh !== true) {
      issues.push("allow evidence requires projection_fresh true");
    }
    if (input.decision_inputs?.redaction_complete !== true) {
      issues.push("allow evidence requires redaction_complete true");
    }
  }

  return { valid: issues.length === 0, issues };
}

export function recomputeAuthorizationDecisionHash(evidence: AuthorizationDecisionEvidence): string {
  const { integrity: _integrity, ...payload } = evidence;
  return sha256(canonicalize(payload));
}

function decisionId(input: AuthorizationDecisionEvidenceInput): string {
  const seed = {
    occurred_at: input.occurred_at,
    correlation_id: input.correlation_id,
    outcome: input.outcome,
    path: input.path,
    action: input.action,
    resource: input.resource,
  };
  return `authzdec_${sha256(canonicalize(seed)).slice(0, 32)}`;
}

function validateResource(resource: DecisionEvidenceResource, issues: string[]): void {
  if (!isRecord(resource)) {
    issues.push("resource must be an object");
    return;
  }
  const required: Array<[keyof DecisionEvidenceResource, unknown]> = [
    ["kind", resource.kind],
    ["resource_id", resource.resource_id],
    ["source_system", resource.source_system],
    ["source_record_id", resource.source_record_id],
    ["source_version", resource.source_version],
    ["projection_version", resource.projection_version],
    ["source_status", resource.source_status],
    ["classification", resource.classification],
    ["legal_hold_status", resource.legal_hold_status],
  ];
  required.forEach(([key, value]) => requireString(value, `resource.${key}`, issues));
}

function validateRedaction(
  redaction: DecisionEvidenceRedaction,
  resourceKind: string | undefined,
  issues: string[],
): void {
  if (!isRecord(redaction)) {
    issues.push("redaction_decision must be an object");
    return;
  }
  requireString(redaction.profile, "redaction_decision.profile", issues);
  requireString(redaction.reason, "redaction_decision.reason", issues);
  if (!Array.isArray(redaction.fields_redacted) || !redaction.fields_redacted.every(isNonEmptyString)) {
    issues.push("redaction_decision.fields_redacted must be an array of strings");
  }
  if (typeof redaction.storage_uri_exposed !== "boolean") {
    issues.push("redaction_decision.storage_uri_exposed must be a boolean");
  }
  if (resourceKind === "platform_evidence" && redaction.storage_uri_exposed) {
    issues.push("platform_evidence decision evidence must not expose storage_uri by default");
  }
}

function validateDecisionInputs(inputs: DecisionEvidenceInputs, issues: string[]): void {
  if (!isRecord(inputs)) {
    issues.push("decision_inputs must be an object");
    return;
  }
  const required: Array<[keyof DecisionEvidenceInputs, unknown]> = [
    ["server_verified", inputs.server_verified],
    ["claim_valid", inputs.claim_valid],
    ["policy_present", inputs.policy_present],
    ["resource_complete", inputs.resource_complete],
    ["projection_fresh", inputs.projection_fresh],
    ["source_active", inputs.source_active],
    ["redaction_complete", inputs.redaction_complete],
    ["storage_uri_exposed", inputs.storage_uri_exposed],
    ["legal_hold_checked", inputs.legal_hold_checked],
    ["jurisdiction_checked", inputs.jurisdiction_checked],
    ["assignment_checked", inputs.assignment_checked],
    ["clearance_checked", inputs.clearance_checked],
    ["purpose_checked", inputs.purpose_checked],
    ["mfa_checked", inputs.mfa_checked],
  ];
  required.forEach(([key, value]) => {
    if (typeof value !== "boolean") {
      issues.push(`decision_inputs.${key} must be a boolean`);
    }
  });
}

function validateRetrieval(retrieval: DecisionEvidenceRetrieval | undefined, issues: string[]): void {
  if (retrieval === undefined) {
    return;
  }
  if (!isRecord(retrieval)) {
    issues.push("retrieval must be an object when provided");
    return;
  }
  requireString(retrieval.retrieval_path, "retrieval.retrieval_path", issues);
  if (!Array.isArray(retrieval.candidate_source_ids) || !retrieval.candidate_source_ids.every(isNonEmptyString)) {
    issues.push("retrieval.candidate_source_ids must be an array of strings");
  }
  if (!Array.isArray(retrieval.citation_ids) || !retrieval.citation_ids.every(isNonEmptyString)) {
    issues.push("retrieval.citation_ids must be an array of strings");
  }
}

function requireIsoTimestamp(value: unknown, label: string, issues: string[]): void {
  requireString(value, label, issues);
  if (isNonEmptyString(value) && Number.isNaN(new Date(value).getTime())) {
    issues.push(`${label} must be an ISO timestamp`);
  }
}

function requireString(value: unknown, label: string, issues: string[]): void {
  if (!isNonEmptyString(value)) {
    issues.push(`${label} must be a non-empty string`);
  }
}

function isSerializable(value: unknown): boolean {
  try {
    canonicalize(value);
    return true;
  } catch (_error) {
    return false;
  }
}

function canonicalize(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item)).join(",")}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
      .join(",")}}`;
  }
  throw new Error("value is not JSON-serializable");
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (Array.isArray(value)) {
    value.forEach((item) => deepFreeze(item));
    return Object.freeze(value) as Readonly<T>;
  }
  if (isRecord(value)) {
    Object.values(value).forEach((item) => deepFreeze(item));
    return Object.freeze(value) as Readonly<T>;
  }
  return value as Readonly<T>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
