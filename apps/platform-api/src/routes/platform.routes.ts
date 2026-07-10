import { randomUUID } from "node:crypto";
import {
  type EntitlementDecision,
  type EntitlementRequest,
  type PlatformClaims,
  evaluateEntitlement,
  validatePlatformClaims,
} from "../../../../packages/authz/src";
import {
  type AuthorizationDecisionEvidence,
  type AuthorizationDecisionEvidenceInput,
  createAuthorizationDecisionEvidence,
} from "../../../../packages/audit-ledger/src";
import {
  PLATFORM_REGISTRY_VERSION,
  appView,
  entitlementRequestForTenant,
  type PlatformAppDefinition,
  type PlatformAppView,
  validateAppRegistry,
} from "../app-registry";
import { case360CaseId, handleCase360Route } from "./case360.routes";
import type { CaseProjectionService } from "../services/case-projection";
import type { EvidenceProjectionService } from "../services/evidence-projection";

export type HealthStatus = "ok" | "degraded" | "down";

export interface PlatformHealthCheckResult {
  name: string;
  status: HealthStatus;
  reason_code: string;
  detail: string;
  required: boolean;
}

export interface PlatformHealthCheck {
  name: string;
  required: boolean;
  run: () => PlatformHealthCheckResult | Promise<PlatformHealthCheckResult>;
}

export interface DecisionEvidenceSink {
  append: (evidence: Readonly<AuthorizationDecisionEvidence>) => void | Promise<void>;
}

export interface PlatformRouteContext {
  apps: readonly PlatformAppDefinition[];
  evidenceSink: DecisionEvidenceSink;
  healthChecks: readonly PlatformHealthCheck[];
  caseProjectionService: CaseProjectionService;
  evidenceProjectionService: EvidenceProjectionService;
  now: () => Date;
  expectedSourceVersion?: string;
  demoAllowAllLaunches?: boolean;
}

interface AuthenticatedClaims {
  claims: PlatformClaims;
  claimInput: unknown;
}

interface EntitlementCheckPayload {
  request: EntitlementRequest;
  claimInput: unknown;
  correlationId: string;
}

interface JsonObject {
  [key: string]: unknown;
}

interface Pagination {
  limit: number;
  offset: number;
}

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

const PUBLIC_HEALTH_PATHS = new Set(["/health", "/api/v1/platform/health"]);
const PUBLIC_READY_PATHS = new Set(["/ready", "/api/v1/platform/ready"]);

export async function handlePlatformRoute(request: Request, context: PlatformRouteContext): Promise<Response> {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  try {
    if (method === "GET" && PUBLIC_HEALTH_PATHS.has(url.pathname)) {
      return jsonResponse(await healthResponse(context), 200);
    }

    if (method === "GET" && PUBLIC_READY_PATHS.has(url.pathname)) {
      const body = await readinessResponse(context);
      return jsonResponse(body, body.ready ? 200 : 503);
    }

    if (method === "GET" && case360CaseId(url.pathname)) {
      return handleCase360Route(request, context);
    }

    if (method === "GET" && url.pathname === "/api/v1/platform/me") {
      const auth = authenticatePlatformClaims(request, context);
      if (!auth.authenticated) {
        return jsonResponse(auth.error, 401);
      }
      return jsonResponse(meResponse(auth.claims), 200);
    }

    if (method === "GET" && (url.pathname === "/api/v1/platform/apps" || url.pathname === "/apps")) {
      const auth = authenticatePlatformClaims(request, context);
      if (!auth.authenticated) {
        return jsonResponse(auth.error, 401);
      }
      return jsonResponse(appsResponse(auth, url, context), 200);
    }

    if (
      method === "POST" &&
      (url.pathname === "/api/v1/platform/entitlements/check" || url.pathname === "/entitlements/check")
    ) {
      const payload = await entitlementCheckPayload(request);
      if (!payload.valid) {
        return jsonResponse(payload.error, 400);
      }
      return entitlementCheckResponse(payload.value, request, context);
    }

    return jsonResponse(
      {
        error: {
          code: "NOT_FOUND",
          message: "route not found",
        },
      },
      404,
    );
  } catch (error: unknown) {
    return jsonResponse(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "platform API request failed",
          reason_code: error instanceof Error ? error.name : "UNKNOWN_ERROR",
        },
      },
      500,
    );
  }
}

export function registryHealthCheck(apps: readonly PlatformAppDefinition[]): PlatformHealthCheck {
  return {
    name: "app-registry",
    required: true,
    run: () => {
      const issues = validateAppRegistry(apps);
      if (issues.length > 0) {
        return {
          name: "app-registry",
          status: "degraded",
          reason_code: issues[0]?.reason_code ?? "APP_REGISTRY_UNSAFE",
          detail: `${issues.length} registry safety issue(s) detected`,
          required: true,
        };
      }
      return {
        name: "app-registry",
        status: "ok",
        reason_code: "APP_REGISTRY_SAFE",
        detail: "registry launch URL gates are safe",
        required: true,
      };
    },
  };
}

export function platformRuntimeHealthCheck(): PlatformHealthCheck {
  return {
    name: "platform-api",
    required: true,
    run: () => ({
      name: "platform-api",
      status: "ok",
      reason_code: "PLATFORM_API_READY",
      detail: "route dispatcher is available",
      required: true,
    }),
  };
}

interface HealthRouteResponse {
  status: HealthStatus;
  reason_codes: string[];
  checks: PlatformHealthCheckResult[];
}

interface ReadinessRouteResponse {
  ready: boolean;
  status: "ready" | "not_ready";
  reason_codes: string[];
  checks: PlatformHealthCheckResult[];
}

async function healthResponse(context: PlatformRouteContext): Promise<HealthRouteResponse> {
  const checks = await runHealthChecks(context);
  const status = aggregateHealthStatus(checks);
  return {
    status,
    reason_codes: checks.filter((check) => check.status !== "ok").map((check) => check.reason_code),
    checks,
  };
}

async function readinessResponse(context: PlatformRouteContext): Promise<ReadinessRouteResponse> {
  const checks = await runHealthChecks(context);
  const blocking = checks.filter((check) => check.required && check.status !== "ok");
  return {
    ready: blocking.length === 0,
    status: blocking.length === 0 ? "ready" : "not_ready",
    reason_codes: blocking.map((check) => check.reason_code),
    checks,
  };
}

async function runHealthChecks(context: PlatformRouteContext): Promise<PlatformHealthCheckResult[]> {
  const checks: PlatformHealthCheckResult[] = [];
  for (const check of context.healthChecks) {
    try {
      checks.push(await check.run());
    } catch (error: unknown) {
      checks.push({
        name: check.name,
        status: "down",
        reason_code: "HEALTH_CHECK_FAILED",
        detail: error instanceof Error ? error.name : "health check failed",
        required: check.required,
      });
    }
  }
  return checks;
}

function aggregateHealthStatus(checks: readonly PlatformHealthCheckResult[]): HealthStatus {
  if (checks.some((check) => check.status === "down")) {
    return "down";
  }
  if (checks.some((check) => check.status === "degraded")) {
    return "degraded";
  }
  return "ok";
}

function meResponse(claims: PlatformClaims): object {
  return {
    schema_version: claims.schema_version,
    claim_version: claims.claim_version,
    source_version: claims.source_version,
    subject: {
      user_id: claims.subject.user_id,
      persona: claims.subject.persona,
      display_name: claims.subject.display_name,
      tenant_id: claims.subject.tenant_id,
      org_id: claims.subject.org_id,
    },
    modules: [...claims.modules],
    domain_permissions: claims.domain_permissions.map((entry) => ({
      domain: entry.domain,
      permissions: [...entry.permissions],
    })),
    mfa_verified: claims.mfa.verified,
    expires_at: claims.expires_at,
  };
}

function appsResponse(auth: AuthenticatedClaims, url: URL, context: PlatformRouteContext): object {
  const pagination = paginationFromUrl(url);
  const apps = context.apps.map((app) => appResponse(auth.claimInput, app, context));
  const page = apps.slice(pagination.offset, pagination.offset + pagination.limit);
  const nextOffset = pagination.offset + pagination.limit < apps.length ? pagination.offset + pagination.limit : null;
  return {
    registry_version: PLATFORM_REGISTRY_VERSION,
    apps: page,
    pagination: {
      limit: pagination.limit,
      offset: pagination.offset,
      total: apps.length,
      next_offset: nextOffset,
    },
  };
}

function callerTenantId(claimInput: unknown): string | null {
  if (typeof claimInput !== "object" || claimInput === null) {
    return null;
  }
  const subject = (claimInput as { subject?: unknown }).subject;
  if (typeof subject !== "object" || subject === null) {
    return null;
  }
  const tenantId = (subject as { tenant_id?: unknown }).tenant_id;
  return typeof tenantId === "string" ? tenantId : null;
}

function appResponse(
  claimInput: unknown,
  app: PlatformAppDefinition,
  context: PlatformRouteContext,
): PlatformAppView & { entitlement: object } {
  const request = entitlementRequestForTenant(app, callerTenantId(claimInput));
  const entitlement = request
    ? evaluateEntitlement(
        claimInput,
        { ...request, serverVerified: true },
        {
          now: context.now(),
          expectedSourceVersion: context.expectedSourceVersion,
        },
      )
    : null;
  const launchCapable = app.state !== "planned" && app.state !== "blocked";
  const entitlementAllowed =
    entitlement?.allowed === true || (context.demoAllowAllLaunches === true && launchCapable);
  const view = appView(app, entitlementAllowed);
  return {
    ...view,
    entitlement: entitlement
      ? {
          allowed: entitlement.allowed,
          reason: entitlement.reason,
          policy_version: entitlement.policy_version,
        }
      : {
          allowed: false,
          reason: "NO_ENTITLEMENT_REQUEST",
          policy_version: "platform.entitlements.v1",
        },
  };
}

async function entitlementCheckResponse(
  payload: EntitlementCheckPayload,
  request: Request,
  context: PlatformRouteContext,
): Promise<Response> {
  const decision = evaluateEntitlement(payload.claimInput, payload.request, {
    now: context.now(),
    expectedSourceVersion: context.expectedSourceVersion,
  });
  const evidence = createEntitlementDecisionEvidence(decision, payload, request, context);
  await context.evidenceSink.append(evidence);
  return jsonResponse(
    {
      allowed: decision.allowed,
      reason: decision.reason,
      detail: decision.allowed ? "allowed" : decision.detail,
      policy_version: decision.policy_version,
      decision_evidence: {
        decision_id: evidence.decision_id,
        evidence_schema_version: evidence.evidence_schema_version,
        outcome: evidence.outcome,
        reason: evidence.reason,
        correlation_id: evidence.correlation_id,
        integrity: evidence.integrity,
      },
    },
    decision.allowed ? 200 : 403,
  );
}

function createEntitlementDecisionEvidence(
  decision: EntitlementDecision,
  payload: EntitlementCheckPayload,
  request: Request,
  context: PlatformRouteContext,
): Readonly<AuthorizationDecisionEvidence> {
  const outcome = decision.allowed ? "allow" : "deny";
  const input: AuthorizationDecisionEvidenceInput = {
    occurred_at: context.now().toISOString(),
    correlation_id: payload.correlationId,
    outcome,
    reason: decision.reason,
    detail: decision.allowed ? "allowed" : decision.detail,
    policy_version: "platform.entitlement_check.v1",
    entitlement_policy_version: decision.policy_version,
    path: new URL(request.url).pathname,
    action: "platform.entitlements.check",
    claims_snapshot: claimSnapshotForDecision(decision, payload.claimInput),
    resource: {
      kind: "app_route",
      resource_id: `${payload.request.domain}:${payload.request.module}:${payload.request.permission}`,
      source_system: payload.request.domain,
      source_record_id: payload.request.module,
      source_version: PLATFORM_REGISTRY_VERSION,
      projection_version: PLATFORM_REGISTRY_VERSION,
      source_status: "active",
      classification: payload.request.requiredClearance,
      legal_hold_status: "none",
    },
    redaction_decision: {
      profile: "entitlement-check-v1",
      fields_redacted: [],
      storage_uri_exposed: false,
      reason: "no_domain_payload_returned",
    },
    decision_inputs: {
      server_verified: payload.request.serverVerified,
      claim_valid: Boolean(decision.claims_snapshot),
      policy_present: true,
      resource_complete: true,
      projection_fresh: true,
      source_active: true,
      redaction_complete: true,
      storage_uri_exposed: false,
      legal_hold_checked: true,
      jurisdiction_checked: true,
      assignment_checked: Boolean(payload.request.assignment),
      clearance_checked: true,
      purpose_checked: true,
      mfa_checked: true,
    },
  };
  return createAuthorizationDecisionEvidence(input);
}

function claimSnapshotForDecision(decision: EntitlementDecision, claimInput: unknown): object {
  if (decision.claims_snapshot) {
    return {
      validation: "valid",
      validation_reason: "ALLOW",
      validation_issues: [],
      ...decision.claims_snapshot,
    };
  }

  return {
    validation: "invalid",
    validation_reason: decision.allowed ? "ALLOW" : decision.reason,
    validation_issues: [decision.allowed ? "allowed" : decision.detail],
    schema_version: readStringPath(claimInput, ["schema_version"]),
    claim_version: readNumberPath(claimInput, ["claim_version"]),
    source_version: readStringPath(claimInput, ["source_version"]),
    subject_id: readStringPath(claimInput, ["subject", "user_id"]),
    persona: readStringPath(claimInput, ["subject", "persona"]),
    session_id: readStringPath(claimInput, ["session_id"]),
    modules: readStringArrayPath(claimInput, ["modules"]),
    domain_permissions: readDomainPermissions(claimInput),
    mfa_verified: readBooleanPath(claimInput, ["mfa", "verified"]),
    expires_at: readStringPath(claimInput, ["expires_at"]),
  };
}

function authenticatePlatformClaims(
  request: Request,
  context: PlatformRouteContext,
):
  | { authenticated: true; claims: PlatformClaims; claimInput: unknown }
  | { authenticated: false; error: object } {
  const claimInput = claimInputFromHeaders(request.headers);
  const serverVerified = request.headers.get("x-platform-claims-verified") === "true";
  if (!serverVerified) {
    return {
      authenticated: false,
      error: {
        error: {
          code: "SERVER_VERIFICATION_REQUIRED",
          message: "platform claims require server-side verification",
        },
      },
    };
  }

  const validation = validatePlatformClaims(claimInput, {
    now: context.now(),
    expectedSourceVersion: context.expectedSourceVersion,
  });
  if (!validation.valid) {
    return {
      authenticated: false,
      error: {
        error: {
          code: "CLAIMS_DENIED",
          message: "platform claims denied",
          reason: validation.reason,
        },
      },
    };
  }

  return { authenticated: true, claims: validation.claims, claimInput };
}

async function entitlementCheckPayload(
  request: Request,
): Promise<{ valid: true; value: EntitlementCheckPayload } | { valid: false; error: object }> {
  const bodyResult = await readJsonBody(request);
  if (!bodyResult.valid) {
    return { valid: false, error: badRequest(bodyResult.reason) };
  }

  const requestInput = isRecord(bodyResult.value.request) ? bodyResult.value.request : bodyResult.value;
  const parsedRequest = entitlementRequestFromInput(requestInput, request);
  if (!parsedRequest.valid) {
    return { valid: false, error: badRequest(parsedRequest.reason) };
  }

  return {
    valid: true,
    value: {
      request: parsedRequest.value,
      claimInput: claimInputFromHeaders(request.headers),
      correlationId: correlationId(request),
    },
  };
}

function entitlementRequestFromInput(
  input: JsonObject,
  request: Request,
): { valid: true; value: EntitlementRequest } | { valid: false; reason: string } {
  const module = readString(input.module);
  const domain = readString(input.domain);
  const permission = readString(input.permission);
  const orgId = readString(input.org_id);
  const purpose = readString(input.purpose);
  const requiredClearance = readClearance(input.requiredClearance);
  const jurisdiction = isRecord(input.jurisdiction) ? input.jurisdiction : null;
  if (!module || !domain || !permission || !orgId || !purpose || !requiredClearance || !jurisdiction) {
    return { valid: false, reason: "entitlement request is missing required fields" };
  }

  const country = readString(jurisdiction.country);
  const state = readString(jurisdiction.state);
  if (!country || !state) {
    return { valid: false, reason: "jurisdiction country and state are required" };
  }

  const requireMfa = typeof input.requireMfa === "boolean" ? input.requireMfa : null;
  if (requireMfa === null) {
    return { valid: false, reason: "requireMfa must be a boolean" };
  }

  return {
    valid: true,
    value: {
      module,
      domain,
      permission,
      org_id: orgId,
      unit_id: readString(input.unit_id) ?? undefined,
      jurisdiction: {
        country,
        state,
        district: readString(jurisdiction.district) ?? undefined,
        police_station: readString(jurisdiction.police_station) ?? undefined,
      },
      requiredClearance,
      assignment: assignmentFromInput(input.assignment),
      purpose,
      requireMfa,
      serverVerified: request.headers.get("x-platform-claims-verified") === "true",
    },
  };
}

function assignmentFromInput(input: unknown): EntitlementRequest["assignment"] {
  if (!isRecord(input)) {
    return undefined;
  }
  return {
    case_id: readString(input.case_id) ?? undefined,
    queue_id: readString(input.queue_id) ?? undefined,
    evidence_id: readString(input.evidence_id) ?? undefined,
  };
}

async function readJsonBody(request: Request): Promise<{ valid: true; value: JsonObject } | { valid: false; reason: string }> {
  const text = await request.text();
  if (!text.trim()) {
    return { valid: false, reason: "request body must be a JSON object" };
  }
  try {
    const value: unknown = JSON.parse(text);
    if (!isRecord(value)) {
      return { valid: false, reason: "request body must be a JSON object" };
    }
    return { valid: true, value };
  } catch (_error: unknown) {
    return { valid: false, reason: "request body must be valid JSON" };
  }
}

function badRequest(message: string): object {
  return {
    error: {
      code: "BAD_REQUEST",
      message,
    },
  };
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

function correlationId(request: Request): string {
  return request.headers.get("x-correlation-id") ?? `corr-${randomUUID()}`;
}

function paginationFromUrl(url: URL): Pagination {
  return {
    limit: boundedInteger(url.searchParams.get("limit"), 50, 1, 100),
    offset: boundedInteger(url.searchParams.get("offset"), 0, 0, 10_000),
  };
}

function boundedInteger(raw: string | null, fallback: number, minimum: number, maximum: number): number {
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, minimum), maximum);
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}

function readClearance(value: unknown): EntitlementRequest["requiredClearance"] | null {
  if (value === "public" || value === "restricted" || value === "confidential" || value === "secret") {
    return value;
  }
  return null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readStringPath(input: unknown, path: readonly string[]): string | null {
  const value = readPath(input, path);
  return readString(value);
}

function readNumberPath(input: unknown, path: readonly string[]): number | null {
  const value = readPath(input, path);
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readBooleanPath(input: unknown, path: readonly string[]): boolean | null {
  const value = readPath(input, path);
  return typeof value === "boolean" ? value : null;
}

function readStringArrayPath(input: unknown, path: readonly string[]): string[] {
  const value = readPath(input, path);
  return Array.isArray(value) && value.every((entry) => typeof entry === "string") ? [...value] : [];
}

function readPath(input: unknown, path: readonly string[]): unknown {
  let current = input;
  for (const segment of path) {
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

function readDomainPermissions(input: unknown): object[] {
  const value = readPath(input, ["domain_permissions"]);
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }
    const domain = readString(entry.domain);
    const permissions = Array.isArray(entry.permissions)
      ? entry.permissions.filter((permission): permission is string => typeof permission === "string")
      : [];
    return domain ? [{ domain, permissions }] : [];
  });
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
