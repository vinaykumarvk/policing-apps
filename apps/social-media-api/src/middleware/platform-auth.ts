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

export const SOCIAL_MEDIA_PLATFORM_AUTH_ADAPTER_VERSION = "social-media-platform-auth-adapter.v1";
export const SOCIAL_MEDIA_PLATFORM_AUTH_GATE_EVIDENCE_REF = "P14-social-media-platform-auth-adapter";

export const SOCIAL_MEDIA_PLATFORM_ENTITLEMENT_REQUEST: Omit<EntitlementRequest, "serverVerified"> = {
  module: "social_media",
  domain: "social_media",
  permission: "content:metadata-read",
  org_id: "state-intelligence",
  unit_id: "analysis-cell",
  jurisdiction: {
    country: "IN",
    state: "PB",
    district: "SAS Nagar",
  },
  requiredClearance: "confidential",
  assignment: { queue_id: "analysis-state-feed" },
  purpose: "intelligence_analysis",
  requireMfa: true,
};

export type SocialMediaPlatformAuthReason =
  | "ALLOW"
  | "PLATFORM_CLAIMS_REQUIRED"
  | "PLATFORM_SESSION_REVOKED"
  | "CLAIM_MALFORMED"
  | ClaimRejectionReason
  | EntitlementDenyReason;

export interface SocialMediaPlatformAuthEvidence {
  adapter_version: string;
  gate_evidence_ref: string;
  policy_version: string;
  service_path: string;
  outcome: "ALLOW" | "DENY";
  reason: SocialMediaPlatformAuthReason;
  correlation_id: string;
  source_version: string;
  projection_version: "not_applicable";
  redaction_decision: "metadata_only";
  server_verified: boolean;
  local_auth_required: true;
  audited_at: string;
  claims_snapshot?: PlatformClaimSnapshot;
}

export type SocialMediaPlatformAuthDecision =
  | {
      allowed: true;
      reason: "ALLOW";
      evidence: SocialMediaPlatformAuthEvidence;
      entitlement: Extract<EntitlementDecision, { allowed: true }>;
    }
  | {
      allowed: false;
      reason: Exclude<SocialMediaPlatformAuthReason, "ALLOW">;
      evidence: SocialMediaPlatformAuthEvidence;
      entitlement?: EntitlementDecision;
    };

export interface SocialMediaPlatformAuthInput {
  claims?: unknown;
  claimsParseError?: string;
  serverVerified: boolean;
  servicePath: string;
  correlationId: string;
}

export interface SocialMediaPlatformAuthOptions {
  now?: Date | string | (() => Date);
  maxAgeSeconds?: number;
  expectedSourceVersion?: string;
  policyVersion?: string;
  revokedSessionIds?: readonly string[] | ReadonlySet<string>;
  auditSink?: (evidence: SocialMediaPlatformAuthEvidence) => void;
}

declare module "fastify" {
  interface FastifyRequest {
    platformAuth?: SocialMediaPlatformAuthEvidence;
  }
}

export function registerSocialMediaPlatformAuthMiddleware(
  app: FastifyInstance,
  options: SocialMediaPlatformAuthOptions = {},
): void {
  app.addHook("preHandler", async (request, reply) => {
    if (!isSocialMediaPlatformLaunchedRequest(request)) {
      return;
    }

    const decision = evaluateSocialMediaPlatformAuth(requestToPlatformAuthInput(request), options);
    request.platformAuth = decision.evidence;
    auditPlatformDecision(request, decision.evidence, options.auditSink);

    if (!decision.allowed) {
      sendPlatformAuthDeny(reply, decision);
    }
  });
}

export function evaluateSocialMediaPlatformAuth(
  input: SocialMediaPlatformAuthInput,
  options: SocialMediaPlatformAuthOptions = {},
): SocialMediaPlatformAuthDecision {
  const now = optionNow(options);
  const policyVersion = options.policyVersion ?? "platform.entitlements.v1";

  if (input.claimsParseError) {
    return deny("CLAIM_MALFORMED", input, now, policyVersion);
  }

  if (input.claims === undefined) {
    return deny("PLATFORM_CLAIMS_REQUIRED", input, now, policyVersion);
  }

  const validation = validatePlatformClaims(input.claims, {
    now,
    maxAgeSeconds: options.maxAgeSeconds,
    expectedSourceVersion: options.expectedSourceVersion,
  });
  if (!validation.valid) {
    return deny(validation.reason, input, now, policyVersion);
  }

  const claims = validation.claims;
  const snapshot = claimEvidenceSnapshot(claims);
  if (isPlatformSessionRevoked(claims, options.revokedSessionIds)) {
    return deny("PLATFORM_SESSION_REVOKED", input, now, policyVersion, snapshot);
  }

  const entitlement = evaluateEntitlement(
    claims,
    {
      ...SOCIAL_MEDIA_PLATFORM_ENTITLEMENT_REQUEST,
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

export function isSocialMediaPlatformLaunchedRequest(request: FastifyRequest): boolean {
  return (
    hasHeader(request, "x-platform-claims") ||
    hasHeader(request, "x-platform-claims-verified") ||
    truthyHeader(request, "x-platform-launch") ||
    truthyHeader(request, "x-platform-launched") ||
    truthyHeader(request, "x-platform-route")
  );
}

function deny(
  reason: Exclude<SocialMediaPlatformAuthReason, "ALLOW">,
  input: SocialMediaPlatformAuthInput,
  now: Date,
  policyVersion: string,
  snapshot?: PlatformClaimSnapshot,
): SocialMediaPlatformAuthDecision {
  return {
    allowed: false,
    reason,
    evidence: evidence(input, now, policyVersion, "DENY", reason, input.serverVerified, snapshot),
  };
}

function evidence(
  input: SocialMediaPlatformAuthInput,
  now: Date,
  policyVersion: string,
  outcome: "ALLOW" | "DENY",
  reason: SocialMediaPlatformAuthReason,
  serverVerified: boolean,
  snapshot?: PlatformClaimSnapshot,
): SocialMediaPlatformAuthEvidence {
  return {
    adapter_version: SOCIAL_MEDIA_PLATFORM_AUTH_ADAPTER_VERSION,
    gate_evidence_ref: SOCIAL_MEDIA_PLATFORM_AUTH_GATE_EVIDENCE_REF,
    policy_version: policyVersion,
    service_path: input.servicePath,
    outcome,
    reason,
    correlation_id: input.correlationId,
    source_version: "social-media-api",
    projection_version: "not_applicable",
    redaction_decision: "metadata_only",
    server_verified: serverVerified,
    local_auth_required: true,
    audited_at: now.toISOString(),
    ...(snapshot ? { claims_snapshot: snapshot } : {}),
  };
}

function requestToPlatformAuthInput(request: FastifyRequest): SocialMediaPlatformAuthInput {
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
  return (process.env.SOCIAL_MEDIA_PLATFORM_REVOKED_SESSIONS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function auditPlatformDecision(
  request: FastifyRequest,
  evidenceValue: SocialMediaPlatformAuthEvidence,
  auditSink?: (evidence: SocialMediaPlatformAuthEvidence) => void,
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
    request.log.info(logPayload, "Social Media platform auth decision");
    return;
  }
  request.log.warn(logPayload, "Social Media platform auth decision");
}

function sendPlatformAuthDeny(
  reply: FastifyReply,
  decision: Exclude<SocialMediaPlatformAuthDecision, { allowed: true }>,
): void {
  reply.code(403).send({
    error: "PLATFORM_AUTH_DENIED",
    message: "Platform authorization denied",
    statusCode: 403,
    reason: decision.reason,
    correlationId: decision.evidence.correlation_id,
  });
}

function optionNow(options: SocialMediaPlatformAuthOptions): Date {
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
