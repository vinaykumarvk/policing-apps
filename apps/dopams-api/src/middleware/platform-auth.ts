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

export const DOPAMS_PLATFORM_AUTH_ADAPTER_VERSION = "dopams-platform-auth-adapter.v1";
export const DOPAMS_PLATFORM_AUTH_GATE_EVIDENCE_REF = "P8-dopams-platform-auth-adapter";

export const DOPAMS_PLATFORM_ENTITLEMENT_REQUEST: Omit<EntitlementRequest, "serverVerified"> = {
  module: "dopams",
  domain: "dopams",
  permission: "case:read",
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
  purpose: "investigation",
  requireMfa: true,
};

export type DopamsPlatformAuthReason =
  | "ALLOW"
  | "PLATFORM_CLAIMS_REQUIRED"
  | "PLATFORM_SESSION_REVOKED"
  | "CLAIM_MALFORMED"
  | "BREAK_GLASS_NOT_CONFIGURED"
  | "BREAK_GLASS_EXPIRED"
  | "BREAK_GLASS_REASON_REQUIRED"
  | ClaimRejectionReason
  | EntitlementDenyReason;

export interface DopamsPlatformAuthEvidence {
  adapter_version: string;
  gate_evidence_ref: string;
  policy_version: string;
  service_path: string;
  outcome: "ALLOW" | "DENY";
  reason: DopamsPlatformAuthReason;
  correlation_id: string;
  source_version: string;
  projection_version: "not_applicable";
  redaction_decision: "not_applicable";
  server_verified: boolean;
  local_auth_required: true;
  audited_at: string;
  claims_snapshot?: PlatformClaimSnapshot;
  break_glass?: {
    expires_at: string;
    reason: string;
  };
}

export type DopamsPlatformAuthDecision =
  | {
      allowed: true;
      reason: "ALLOW";
      evidence: DopamsPlatformAuthEvidence;
      entitlement: Extract<EntitlementDecision, { allowed: true }>;
    }
  | {
      allowed: false;
      reason: Exclude<DopamsPlatformAuthReason, "ALLOW">;
      evidence: DopamsPlatformAuthEvidence;
      entitlement?: EntitlementDecision;
    };

export interface DopamsPlatformAuthInput {
  claims?: unknown;
  claimsParseError?: string;
  serverVerified: boolean;
  servicePath: string;
  correlationId: string;
  breakGlass?: {
    requested: boolean;
    expiresAt?: Date | string;
    reason?: string;
  };
}

export interface DopamsPlatformAuthOptions {
  now?: Date | string | (() => Date);
  maxAgeSeconds?: number;
  expectedSourceVersion?: string;
  policyVersion?: string;
  revokedSessionIds?: readonly string[] | ReadonlySet<string>;
  breakGlassUntil?: Date | string;
  breakGlassReason?: string;
  auditSink?: (evidence: DopamsPlatformAuthEvidence) => void;
}

declare module "fastify" {
  interface FastifyRequest {
    platformAuth?: DopamsPlatformAuthEvidence;
  }
}

export function registerDopamsPlatformAuthMiddleware(
  app: FastifyInstance,
  options: DopamsPlatformAuthOptions = {},
): void {
  app.addHook("preHandler", async (request, reply) => {
    if (!isDopamsPlatformLaunchedRequest(request)) {
      return;
    }

    const decision = evaluateDopamsPlatformAuth(requestToPlatformAuthInput(request, options), options);
    request.platformAuth = decision.evidence;
    auditPlatformDecision(request, decision.evidence, options.auditSink);

    if (!decision.allowed) {
      sendPlatformAuthDeny(reply, decision);
    }
  });
}

export function evaluateDopamsPlatformAuth(
  input: DopamsPlatformAuthInput,
  options: DopamsPlatformAuthOptions = {},
): DopamsPlatformAuthDecision {
  const now = optionNow(options);
  const policyVersion = options.policyVersion ?? "platform.entitlements.v1";

  if (input.breakGlass?.requested) {
    return evaluateBreakGlass(input, options, now, policyVersion);
  }

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
      ...DOPAMS_PLATFORM_ENTITLEMENT_REQUEST,
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
      evidence: evidence(input, options, now, policyVersion, "DENY", entitlement.reason, input.serverVerified, entitlement.claims_snapshot),
      entitlement,
    };
  }

  return {
    allowed: true,
    reason: "ALLOW",
    evidence: evidence(input, options, now, entitlement.policy_version, "ALLOW", "ALLOW", input.serverVerified, entitlement.claims_snapshot),
    entitlement,
  };
}

export function isDopamsPlatformLaunchedRequest(request: FastifyRequest): boolean {
  return (
    hasHeader(request, "x-platform-claims") ||
    hasHeader(request, "x-platform-claims-verified") ||
    truthyHeader(request, "x-platform-launch") ||
    truthyHeader(request, "x-platform-launched") ||
    truthyHeader(request, "x-platform-route")
  );
}

function evaluateBreakGlass(
  input: DopamsPlatformAuthInput,
  options: DopamsPlatformAuthOptions,
  now: Date,
  policyVersion: string,
): DopamsPlatformAuthDecision {
  const expiresAt = input.breakGlass?.expiresAt ?? options.breakGlassUntil ?? process.env.DOPAMS_PLATFORM_BREAK_GLASS_UNTIL;
  if (!expiresAt) {
    return deny("BREAK_GLASS_NOT_CONFIGURED", input, options, now, policyVersion);
  }

  const parsedExpiresAt = toDate(expiresAt);
  if (!parsedExpiresAt || parsedExpiresAt.getTime() <= now.getTime()) {
    return deny("BREAK_GLASS_EXPIRED", input, options, now, policyVersion);
  }

  const reason = input.breakGlass?.reason ?? options.breakGlassReason ?? process.env.DOPAMS_PLATFORM_BREAK_GLASS_REASON;
  if (!reason || !reason.trim()) {
    return deny("BREAK_GLASS_REASON_REQUIRED", input, options, now, policyVersion);
  }

  return {
    allowed: true,
    reason: "ALLOW",
    evidence: {
      ...evidence(input, options, now, policyVersion, "ALLOW", "ALLOW", false),
      break_glass: {
        expires_at: parsedExpiresAt.toISOString(),
        reason,
      },
    },
    entitlement: {
      allowed: true,
      policy_version: policyVersion,
      reason: "ALLOW",
      claims_snapshot: emptyBreakGlassSnapshot(),
    },
  };
}

function deny(
  reason: Exclude<DopamsPlatformAuthReason, "ALLOW">,
  input: DopamsPlatformAuthInput,
  options: DopamsPlatformAuthOptions,
  now: Date,
  policyVersion: string,
  snapshot?: PlatformClaimSnapshot,
): DopamsPlatformAuthDecision {
  return {
    allowed: false,
    reason,
    evidence: evidence(input, options, now, policyVersion, "DENY", reason, input.serverVerified, snapshot),
  };
}

function evidence(
  input: DopamsPlatformAuthInput,
  _options: DopamsPlatformAuthOptions,
  now: Date,
  policyVersion: string,
  outcome: "ALLOW" | "DENY",
  reason: DopamsPlatformAuthReason,
  serverVerified: boolean,
  snapshot?: PlatformClaimSnapshot,
): DopamsPlatformAuthEvidence {
  return {
    adapter_version: DOPAMS_PLATFORM_AUTH_ADAPTER_VERSION,
    gate_evidence_ref: DOPAMS_PLATFORM_AUTH_GATE_EVIDENCE_REF,
    policy_version: policyVersion,
    service_path: input.servicePath,
    outcome,
    reason,
    correlation_id: input.correlationId,
    source_version: "dopams-api",
    projection_version: "not_applicable",
    redaction_decision: "not_applicable",
    server_verified: serverVerified,
    local_auth_required: true,
    audited_at: now.toISOString(),
    ...(snapshot ? { claims_snapshot: snapshot } : {}),
  };
}

function requestToPlatformAuthInput(
  request: FastifyRequest,
  options: DopamsPlatformAuthOptions,
): DopamsPlatformAuthInput {
  const claimsHeader = firstHeader(request, "x-platform-claims");
  const parsedClaims = parseClaimsHeader(claimsHeader);
  return {
    ...(parsedClaims.claims !== undefined ? { claims: parsedClaims.claims } : {}),
    ...(parsedClaims.error ? { claimsParseError: parsedClaims.error } : {}),
    serverVerified: truthyHeader(request, "x-platform-claims-verified"),
    servicePath: request.url.split("?")[0],
    correlationId: firstHeader(request, "x-correlation-id") ?? firstHeader(request, "x-request-id") ?? request.id,
    breakGlass: {
      requested: truthyHeader(request, "x-platform-break-glass"),
      expiresAt: firstHeader(request, "x-platform-break-glass-until") ?? options.breakGlassUntil,
      reason: firstHeader(request, "x-platform-break-glass-reason") ?? options.breakGlassReason,
    },
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
  return (process.env.DOPAMS_PLATFORM_REVOKED_SESSIONS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function auditPlatformDecision(
  request: FastifyRequest,
  evidenceValue: DopamsPlatformAuthEvidence,
  auditSink?: (evidence: DopamsPlatformAuthEvidence) => void,
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
    break_glass_expires_at: evidenceValue.break_glass?.expires_at,
  };
  if (evidenceValue.outcome === "ALLOW" && !evidenceValue.break_glass) {
    request.log.info(logPayload, "DOPAMS platform auth decision");
    return;
  }
  request.log.warn(logPayload, "DOPAMS platform auth decision");
}

function sendPlatformAuthDeny(reply: FastifyReply, decision: Exclude<DopamsPlatformAuthDecision, { allowed: true }>): void {
  reply.code(403).send({
    error: "PLATFORM_AUTH_DENIED",
    message: "Platform authorization denied",
    statusCode: 403,
    reason: decision.reason,
    correlationId: decision.evidence.correlation_id,
  });
}

function optionNow(options: DopamsPlatformAuthOptions): Date {
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

function emptyBreakGlassSnapshot(): PlatformClaimSnapshot {
  return {
    schema_version: "break-glass",
    claim_version: 1,
    source_version: "break-glass",
    subject_id: "break-glass",
    persona: "break_glass",
    session_id: "break-glass",
    modules: ["dopams"],
    domain_permissions: [{ domain: "dopams", permissions: ["case:read"] }],
    org: {
      tenant_id: "punjab-police",
      org_id: "mohali-district",
      unit_ids: ["narcotics-cell-mohali"],
      scope: "unit",
    },
    jurisdiction: {
      country: "IN",
      state: "PB",
      districts: ["SAS Nagar"],
      police_stations: ["Phase-8"],
      scope: "district",
    },
    clearance: {
      level: "confidential",
      compartments: ["break_glass"],
    },
    assignment: {
      case_ids: ["CASE-DOPAMS-001"],
      queue_ids: [],
      evidence_ids: [],
      jurisdiction_wide: false,
      domain_wide: false,
    },
    purpose: {
      allowed: ["investigation"],
    },
    mfa_verified: false,
    expires_at: new Date(0).toISOString(),
  };
}
