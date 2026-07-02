import {
  type ClaimValidationOptions,
  type ClearanceLevel,
  type PlatformClaimSnapshot,
  type PlatformClaims,
  claimEvidenceSnapshot,
  clearanceRank,
  validatePlatformClaims,
} from "./claims";

export type EntitlementDenyReason =
  | "REQUEST_INCOMPLETE"
  | "SERVER_VERIFICATION_REQUIRED"
  | "CLAIMS_DENIED"
  | "MODULE_DENIED"
  | "DOMAIN_DENIED"
  | "ORG_DENIED"
  | "JURISDICTION_DENIED"
  | "CLEARANCE_DENIED"
  | "ASSIGNMENT_DENIED"
  | "PURPOSE_DENIED"
  | "MFA_DENIED";

export interface EntitlementJurisdictionRequest {
  country: string;
  state: string;
  district?: string;
  police_station?: string;
}

export interface EntitlementAssignmentRequest {
  case_id?: string;
  queue_id?: string;
  evidence_id?: string;
}

export interface EntitlementRequest {
  module: string;
  domain: string;
  permission: string;
  org_id: string;
  unit_id?: string;
  jurisdiction: EntitlementJurisdictionRequest;
  requiredClearance: ClearanceLevel;
  assignment?: EntitlementAssignmentRequest;
  purpose: string;
  requireMfa: boolean;
  serverVerified: boolean;
}

export interface EntitlementOptions extends ClaimValidationOptions {
  policyVersion?: string;
}

export type EntitlementDecision =
  | {
      allowed: true;
      policy_version: string;
      reason: "ALLOW";
      claims_snapshot: PlatformClaimSnapshot;
    }
  | {
      allowed: false;
      policy_version: string;
      reason: EntitlementDenyReason;
      detail: string;
      claims_snapshot?: PlatformClaimSnapshot;
    };

const DEFAULT_POLICY_VERSION = "platform.entitlements.v1";
const CLEARANCE_LEVELS: readonly ClearanceLevel[] = ["public", "restricted", "confidential", "secret"];

export function evaluateEntitlement(
  claimInput: unknown,
  request: EntitlementRequest,
  options: EntitlementOptions = {},
): EntitlementDecision {
  const policyVersion = options.policyVersion ?? DEFAULT_POLICY_VERSION;
  const requestIssue = requestCompletenessIssue(request);
  if (requestIssue) {
    return deny(policyVersion, "REQUEST_INCOMPLETE", requestIssue);
  }

  if (!request.serverVerified) {
    return deny(policyVersion, "SERVER_VERIFICATION_REQUIRED", "entitlement checks require server-side claim verification");
  }

  const validation = validatePlatformClaims(claimInput, options);
  if (!validation.valid) {
    return deny(policyVersion, "CLAIMS_DENIED", validation.reason);
  }

  const claims = validation.claims;
  const snapshot = claimEvidenceSnapshot(claims);

  if (!claims.modules.includes(request.module)) {
    return deny(policyVersion, "MODULE_DENIED", `module ${request.module} is not present`, snapshot);
  }

  const domainClaim = claims.domain_permissions.find((entry) => entry.domain === request.domain);
  if (!domainClaim || !domainClaim.permissions.includes(request.permission)) {
    return deny(policyVersion, "DOMAIN_DENIED", `permission ${request.domain}:${request.permission} is not present`, snapshot);
  }

  if (!orgAllows(claims, request)) {
    return deny(policyVersion, "ORG_DENIED", "org or unit scope does not match", snapshot);
  }

  if (!jurisdictionAllows(claims, request.jurisdiction)) {
    return deny(policyVersion, "JURISDICTION_DENIED", "jurisdiction scope does not match", snapshot);
  }

  if (clearanceRank(claims.clearance.level) < clearanceRank(request.requiredClearance)) {
    return deny(policyVersion, "CLEARANCE_DENIED", "claim clearance is below required clearance", snapshot);
  }

  if (!assignmentAllows(claims, request.assignment)) {
    return deny(policyVersion, "ASSIGNMENT_DENIED", "assignment scope does not match", snapshot);
  }

  if (!claims.purpose.allowed.includes(request.purpose)) {
    return deny(policyVersion, "PURPOSE_DENIED", `purpose ${request.purpose} is not allowed`, snapshot);
  }

  if (request.requireMfa && !mfaAllows(claims)) {
    return deny(policyVersion, "MFA_DENIED", "MFA is required and not verified", snapshot);
  }

  return {
    allowed: true,
    policy_version: policyVersion,
    reason: "ALLOW",
    claims_snapshot: snapshot,
  };
}

function deny(
  policyVersion: string,
  reason: EntitlementDenyReason,
  detail: string,
  snapshot?: PlatformClaimSnapshot,
): EntitlementDecision {
  if (snapshot) {
    return { allowed: false, policy_version: policyVersion, reason, detail, claims_snapshot: snapshot };
  }
  return { allowed: false, policy_version: policyVersion, reason, detail };
}

function requestCompletenessIssue(request: EntitlementRequest): string | null {
  if (!request) {
    return "request is required";
  }
  if (typeof request.module !== "string") {
    return "module is required";
  }
  if (!request.module.trim()) {
    return "module is required";
  }
  if (typeof request.domain !== "string") {
    return "domain is required";
  }
  if (!request.domain.trim()) {
    return "domain is required";
  }
  if (typeof request.permission !== "string") {
    return "permission is required";
  }
  if (!request.permission.trim()) {
    return "permission is required";
  }
  if (typeof request.org_id !== "string") {
    return "org_id is required";
  }
  if (!request.org_id.trim()) {
    return "org_id is required";
  }
  if (request.unit_id !== undefined && typeof request.unit_id !== "string") {
    return "unit_id must be a string when provided";
  }
  if (!CLEARANCE_LEVELS.includes(request.requiredClearance)) {
    return "requiredClearance must be public, restricted, confidential, or secret";
  }
  if (typeof request.purpose !== "string") {
    return "purpose is required";
  }
  if (!request.purpose.trim()) {
    return "purpose is required";
  }
  if (typeof request.requireMfa !== "boolean") {
    return "requireMfa must be a boolean";
  }
  if (typeof request.serverVerified !== "boolean") {
    return "serverVerified must be a boolean";
  }
  if (!request.jurisdiction) {
    return "jurisdiction is required";
  }
  if (typeof request.jurisdiction.country !== "string" || typeof request.jurisdiction.state !== "string") {
    return "jurisdiction country and state are required";
  }
  if (!request.jurisdiction.country.trim() || !request.jurisdiction.state.trim()) {
    return "jurisdiction country and state are required";
  }
  if (request.jurisdiction.district !== undefined && typeof request.jurisdiction.district !== "string") {
    return "jurisdiction district must be a string when provided";
  }
  if (request.jurisdiction.police_station !== undefined && typeof request.jurisdiction.police_station !== "string") {
    return "jurisdiction police_station must be a string when provided";
  }
  return null;
}

function orgAllows(claims: PlatformClaims, request: EntitlementRequest): boolean {
  if (claims.org.org_id !== request.org_id) {
    return false;
  }
  if (!request.unit_id) {
    return true;
  }
  if (claims.org.scope === "org") {
    return true;
  }
  return claims.org.unit_ids.includes(request.unit_id);
}

function jurisdictionAllows(claims: PlatformClaims, request: EntitlementJurisdictionRequest): boolean {
  if (claims.jurisdiction.country !== request.country || claims.jurisdiction.state !== request.state) {
    return false;
  }

  if (claims.jurisdiction.scope === "national" || claims.jurisdiction.scope === "state") {
    return true;
  }

  if (claims.jurisdiction.scope === "district") {
    return Boolean(request.district && claims.jurisdiction.districts.includes(request.district));
  }

  return Boolean(
    request.district &&
      request.police_station &&
      claims.jurisdiction.districts.includes(request.district) &&
      claims.jurisdiction.police_stations.includes(request.police_station),
  );
}

function assignmentAllows(claims: PlatformClaims, assignment?: EntitlementAssignmentRequest): boolean {
  if (!assignment) {
    return false;
  }

  if (claims.assignment.domain_wide || claims.assignment.jurisdiction_wide) {
    return true;
  }

  if (assignment.case_id && claims.assignment.case_ids.includes(assignment.case_id)) {
    return true;
  }
  if (assignment.queue_id && claims.assignment.queue_ids.includes(assignment.queue_id)) {
    return true;
  }
  if (assignment.evidence_id && claims.assignment.evidence_ids.includes(assignment.evidence_id)) {
    return true;
  }

  return false;
}

function mfaAllows(claims: PlatformClaims): boolean {
  return claims.mfa.required && claims.mfa.verified && claims.mfa.methods.length > 0 && Boolean(claims.mfa.verified_at);
}
