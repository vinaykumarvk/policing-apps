export type PlatformAppState = "planned" | "pilot" | "available" | "blocked";

export interface PlatformClaimGate {
  domain: string;
  status: "passed" | "pending" | "failed";
  server_side_enforced: boolean;
  evidence_ref: string;
  checked_at: string;
  reason_code: string;
}

export interface PlatformEntitlementView {
  allowed: boolean;
  reason: string;
  policy_version: string;
}

export interface PlatformAppView {
  id: string;
  module: string;
  domain: string;
  label: string;
  state: PlatformAppState;
  description: string;
  status_reason_code: string;
  platform_claim_gate: PlatformClaimGate;
  entitlement: PlatformEntitlementView;
  launch_url?: string;
  launch_block_reason?: string;
}

export interface PlatformAppsResponse {
  registry_version: string;
  apps: PlatformAppView[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    next_offset: number | null;
  };
}

export interface PlatformMeResponse {
  schema_version: string;
  claim_version: number;
  source_version: string;
  subject: {
    user_id: string;
    persona: string;
    display_name: string;
    tenant_id: string;
    org_id: string;
  };
  modules: string[];
  domain_permissions: Array<{
    domain: string;
    permissions: string[];
  }>;
  mfa_verified: boolean;
  expires_at: string;
}

export interface PlatformShellData {
  me: PlatformMeResponse;
  registry: PlatformAppsResponse;
}

export interface PlatformApiClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export async function fetchPlatformShellData(options: PlatformApiClientOptions = {}): Promise<PlatformShellData> {
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? platformApiBaseUrl());
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const headers = { accept: "application/json" };
  const [me, registry] = await Promise.all([
    getJson<PlatformMeResponse>(fetchImpl, `${baseUrl}/api/v1/platform/me`, headers),
    getJson<PlatformAppsResponse>(fetchImpl, `${baseUrl}/api/v1/platform/apps?limit=100`, headers),
  ]);

  return { me, registry };
}

export interface PlatformSessionUser {
  username: string;
  display_name: string;
  persona: string;
}

export interface PlatformSessionResponse {
  authenticated: boolean;
  user?: PlatformSessionUser;
}

export async function fetchPlatformSession(
  options: PlatformApiClientOptions = {},
): Promise<PlatformSessionResponse> {
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? platformApiBaseUrl());
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  return getJson<PlatformSessionResponse>(fetchImpl, `${baseUrl}/api/v1/platform/auth/session`, {
    accept: "application/json",
  });
}

export async function platformLogin(
  credentials: { username: string; password: string; totp: string },
  options: PlatformApiClientOptions = {},
): Promise<PlatformSessionUser> {
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? platformApiBaseUrl());
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const response = await fetchImpl(`${baseUrl}/api/v1/platform/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(credentials),
  });
  const body = (await response.json()) as {
    user?: PlatformSessionUser;
    error?: { code?: string };
  };
  if (!response.ok || !body.user) {
    throw new Error(body.error?.code ?? `PLATFORM_LOGIN_${response.status}`);
  }
  return body.user;
}

export async function platformLogout(options: PlatformApiClientOptions = {}): Promise<void> {
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? platformApiBaseUrl());
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  await fetchImpl(`${baseUrl}/api/v1/platform/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
}

function platformApiBaseUrl(): string {
  return import.meta.env.VITE_PLATFORM_API_BASE_URL ?? "";
}

function normalizeBaseUrl(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

async function getJson<T>(fetchImpl: typeof fetch, url: string, headers: HeadersInit): Promise<T> {
  const response = await fetchImpl(url, {
    credentials: "include",
    headers,
  });

  if (!response.ok) {
    throw new Error(`PLATFORM_API_${response.status}`);
  }

  return (await response.json()) as T;
}
