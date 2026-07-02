import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  type ClaimRejectionReason,
  type EntitlementDecision,
  type EntitlementDenyReason,
  type EntitlementRequest,
  type PlatformClaimSnapshot,
  type PlatformClaims,
  claimEvidenceSnapshot,
  evaluateEntitlement,
  validatePlatformClaims,
} from "@policing-platform/authz";

export const FORENSIC_PLATFORM_AUTH_ADAPTER_VERSION = "forensic-platform-auth-adapter.v1";
export const FORENSIC_PLATFORM_AUTH_GATE_EVIDENCE_REF = "P13-forensic-platform-auth-adapter";

export const FORENSIC_PLATFORM_ENTITLEMENT_REQUEST: Omit<EntitlementRequest, "serverVerified"> = {
  module: "forensic",
  domain: "forensic",
  permission: "evidence:metadata-read",
  org_id: "forensic-lab",
  unit_id: "digital-forensics",
  jurisdiction: {
    country: "IN",
    state: "PB",
    district: "SAS Nagar",
  },
  requiredClearance: "secret",
  assignment: { evidence_id: "EVID-DOPAMS-001" },
  purpose: "forensic_review",
  requireMfa: true,
};

export type ForensicPlatformAuthReason =
  | "ALLOW"
  | "PLATFORM_CLAIMS_REQUIRED"
  | "PLATFORM_SESSION_REVOKED"
  | "CLAIM_MALFORMED"
  | ClaimRejectionReason
  | EntitlementDenyReason;

export interface ForensicPlatformAuthEvidence {
  adapter_version: string;
  gate_evidence_ref: string;
  policy_version: string;
  service_path: string;
  outcome: "ALLOW" | "DENY";
  reason: ForensicPlatformAuthReason;
  correlation_id: string;
  source_version: string;
  projection_version: "not_applicable";
  redaction_decision: "metadata_only";
  server_verified: boolean;
  local_auth_required: true;
  audited_at: string;
  claims_snapshot?: PlatformClaimSnapshot;
}

export type ForensicPlatformAuthDecision =
  | {
      allowed: true;
      reason: "ALLOW";
      evidence: ForensicPlatformAuthEvidence;
      entitlement: Extract<EntitlementDecision, { allowed: true }>;
    }
  | {
      allowed: false;
      reason: Exclude<ForensicPlatformAuthReason, "ALLOW">;
      evidence: ForensicPlatformAuthEvidence;
      entitlement?: EntitlementDecision;
    };

export interface ForensicPlatformAuthInput {
  claims?: unknown;
  claimsParseError?: string;
  serverVerified: boolean;
  servicePath: string;
  correlationId: string;
}

export interface ForensicPlatformAuthOptions {
  now?: Date | string | (() => Date);
  maxAgeSeconds?: number;
  expectedSourceVersion?: string;
  policyVersion?: string;
  revokedSessionIds?: readonly string[] | ReadonlySet<string>;
  auditSink?: (evidence: ForensicPlatformAuthEvidence) => void;
}

declare module "fastify" {
  interface FastifyRequest {
    platformAuth?: ForensicPlatformAuthEvidence;
  }
}

export function registerForensicPlatformAuthMiddleware(
  app: FastifyInstance,
  options: ForensicPlatformAuthOptions = {},
): void {
  app.addHook("preHandler", async (request, reply) => {
    if (!isForensicPlatformLaunchedRequest(request)) {
      return;
    }

    const decision = evaluateForensicPlatformAuth(requestToPlatformAuthInput(request), options);
    request.platformAuth = decision.evidence;
    auditPlatformDecision(request, decision.evidence, options.auditSink);

    if (!decision.allowed) {
      sendPlatformAuthDeny(reply, decision);
    }
  });
}

export function evaluateForensicPlatformAuth(
  input: ForensicPlatformAuthInput,
  options: ForensicPlatformAuthOptions = {},
): ForensicPlatformAuthDecision {
  const now = optionNow(options);
  const policyVersion = options.policyVersion ?? "platform.entitlements.v1";

  if (input.claimsParseError) {
    return deny("CLAIM_MALFORMED", input, options, now, policyVersion);
  }

  if (input.claims === undefined) {
    return deny("PLATFORM_CLAIMS_REQUIRED", input, options, now, policyVersion);
  }

  const validation = validatePlatformClaims(input.claims, {
    now,
    maxAgeSeconds: options.maxAgeSeconds,
    expectedSourceVersion: options.expectedSourceVersion,
  });
  if (!validation.valid) {
    return deny(validation.reason, input, options, now, policyVersion);
  }

  const claims = validation.claims;
  const snapshot = claimEvidenceSnapshot(claims);
  if (isPlatformSessionRevoked(claims, options.revokedSessionIds)) {
    return deny("PLATFORM_SESSION_REVOKED", input, options, now, policyVersion, snapshot);
  }

  const entitlement = evaluateEntitlement(
    claims,
    {
      ...FORENSIC_PLATFORM_ENTITLEMENT_REQUEST,
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
      evidence: evidence(input, now, policyVersion, "DENY", entitlement.reason, input.serverVerified, entitlement.claims_snapshot ?? snapshot),
      entitlement,
    };
  }

  return {
    allowed: true,
    reason: "ALLOW",
    evidence: evidence(input, now, entitlement.policy_version, "ALLOW", "ALLOW", input.serverVerified, entitlement.claims_snapshot),
    entitlement,
  };
}

export function isForensicPlatformLaunchedRequest(request: FastifyRequest): boolean {
  return (
    hasHeader(request, "x-platform-claims") ||
    hasHeader(request, "x-platform-claims-verified") ||
    truthyHeader(request, "x-platform-launch") ||
    truthyHeader(request, "x-platform-launched") ||
    truthyHeader(request, "x-platform-route")
  );
}

function deny(
  reason: Exclude<ForensicPlatformAuthReason, "ALLOW">,
  input: ForensicPlatformAuthInput,
  _options: ForensicPlatformAuthOptions,
  now: Date,
  policyVersion: string,
  snapshot?: PlatformClaimSnapshot,
): ForensicPlatformAuthDecision {
  return {
    allowed: false,
    reason,
    evidence: evidence(input, now, policyVersion, "DENY", reason, input.serverVerified, snapshot),
  };
}

function evidence(
  input: ForensicPlatformAuthInput,
  now: Date,
  policyVersion: string,
  outcome: "ALLOW" | "DENY",
  reason: ForensicPlatformAuthReason,
  serverVerified: boolean,
  snapshot?: PlatformClaimSnapshot,
): ForensicPlatformAuthEvidence {
  return {
    adapter_version: FORENSIC_PLATFORM_AUTH_ADAPTER_VERSION,
    gate_evidence_ref: FORENSIC_PLATFORM_AUTH_GATE_EVIDENCE_REF,
    policy_version: policyVersion,
    service_path: input.servicePath,
    outcome,
    reason,
    correlation_id: input.correlationId,
    source_version: "forensic-api",
    projection_version: "not_applicable",
    redaction_decision: "metadata_only",
    server_verified: serverVerified,
    local_auth_required: true,
    audited_at: now.toISOString(),
    ...(snapshot ? { claims_snapshot: snapshot } : {}),
  };
}

function requestToPlatformAuthInput(request: FastifyRequest): ForensicPlatformAuthInput {
  const claimsHeader = firstHeader(request, "x-platform-claims");
  const parsedClaims = parseClaimsHeader(claimsHeader);
  return {
    ...(parsedClaims.claims !== undefined ? { claims: parsedClaims.claims } : {}),
    ...(parsedClaims.error ? { claimsParseError: parsedClaims.error } : {}),
    serverVerified: truthyHeader(request, "x-platform-claims-verified"),
    servicePath: request.url.split("?")[0],
    correlationId: firstHeader(request, "x-correlation-id") ?? firstHeader(request, "x-request-id") ?? request.id,
  };
}

function parseClaimsHeader(raw: string | null): { claims?: unknown; error?: string } {
  if (raw === null) {
    return {};
  }
  try {
    return { claims: JSON.parse(raw) };
  } catch {
    return { error: "x-platform-claims must be valid JSON" };
  }
}

function isPlatformSessionRevoked(
  claims: PlatformClaims,
  configuredRevokedSessionIds?: readonly string[] | ReadonlySet<string>,
): boolean {
  const revoked = configuredRevokedSessionIds ?? revokedSessionsFromEnv();
  return Array.from(revoked).includes(claims.session_id);
}

function revokedSessionsFromEnv(): readonly string[] {
  return (process.env.FORENSIC_PLATFORM_REVOKED_SESSIONS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function auditPlatformDecision(
  request: FastifyRequest,
  evidenceValue: ForensicPlatformAuthEvidence,
  auditSink?: (evidence: ForensicPlatformAuthEvidence) => void,
): void {
  if (auditSink) {
    auditSink(evidenceValue);
    return;
  }

  const logPayload = {
    adapter_version: evidenceValue.adapter_version,
    gate_evidence_ref: evidenceValue.gate_evidence_ref,
    outcome: evidenceValue.outcome,
    reason: evidenceValue.reason,
    correlation_id: evidenceValue.correlation_id,
    service_path: evidenceValue.service_path,
  };
  if (evidenceValue.outcome === "ALLOW") {
    request.log.info(logPayload, "Forensic platform auth decision");
    return;
  }
  request.log.warn(logPayload, "Forensic platform auth decision");
}

function sendPlatformAuthDeny(reply: FastifyReply, decision: Exclude<ForensicPlatformAuthDecision, { allowed: true }>): void {
  reply.code(403).send({
    error: "PLATFORM_AUTH_DENIED",
    message: "Platform authorization denied",
    statusCode: 403,
    reason: decision.reason,
    correlationId: decision.evidence.correlation_id,
  });
}

function optionNow(options: ForensicPlatformAuthOptions): Date {
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

function hasHeader(request: FastifyRequest, name: string): boolean {
  return firstHeader(request, name) !== null;
}

function truthyHeader(request: FastifyRequest, name: string): boolean {
  const value = firstHeader(request, name);
  if (!value) {
    return false;
  }
  return ["1", "true", "yes", "platform"].includes(value.trim().toLowerCase());
}

function firstHeader(request: FastifyRequest, name: string): string | null {
  const value = request.headers[name];
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}
