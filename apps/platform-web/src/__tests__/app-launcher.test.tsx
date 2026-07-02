import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AppLauncher, launchUrlForDisplay } from "../components/AppLauncher";
import { DecisionAuditPanel } from "../components/DecisionAuditPanel";
import { moduleRouteRowsFromRegistry, RouteTable } from "../routes";
import { fetchPlatformShellData, type PlatformAppView, type PlatformMeResponse } from "../platform-api";

const registryApps: PlatformAppView[] = [
  platformApp({
    id: "dopams",
    label: "DOPAMS",
    module: "dopams",
    domain: "dopams",
    state: "pilot",
    launch_url: "/domains/dopams",
    entitlement: { allowed: true, reason: "ALLOW", policy_version: "platform.entitlements.v1" },
  }),
  platformApp({
    id: "iqw",
    label: "IQW Intake",
    module: "iqw",
    domain: "iqw",
    state: "pilot",
    launch_url: "/domains/iqw",
    entitlement: { allowed: true, reason: "ALLOW", policy_version: "platform.entitlements.v1" },
  }),
  platformApp({
    id: "forensic",
    label: "Forensic Lab",
    module: "forensic",
    domain: "forensic",
    state: "pilot",
    launch_url: "/domains/forensic",
    entitlement: { allowed: true, reason: "ALLOW", policy_version: "platform.entitlements.v1" },
  }),
  platformApp({
    id: "social-media",
    label: "Social Media Intelligence",
    module: "social_media",
    domain: "social_media",
    state: "pilot",
    launch_url: "/domains/social-media",
    entitlement: {
      allowed: true,
      reason: "ALLOW",
      policy_version: "platform.entitlements.v1",
    },
    evidenceRef: "P14-social-media-platform-auth-adapter",
  }),
  platformApp({
    id: "knowledge",
    label: "Knowledge Search",
    module: "knowledge",
    domain: "knowledge",
    state: "pilot",
    launch_url: "/domains/knowledge",
    entitlement: {
      allowed: true,
      reason: "ALLOW",
      policy_version: "platform.entitlements.v1",
    },
    evidenceRef: "P15-knowledge-platform-auth-adapter",
  }),
];

const me: PlatformMeResponse = {
  schema_version: "platform.claims.v1",
  claim_version: 1,
  source_version: "idp-seed-v1",
  subject: {
    user_id: "user-io-001",
    persona: "io",
    display_name: "Investigating Officer",
    tenant_id: "punjab-police",
    org_id: "mohali-district",
  },
  modules: ["dopams", "iqw", "forensic", "knowledge"],
  domain_permissions: [
    { domain: "dopams", permissions: ["case:read"] },
    { domain: "iqw", permissions: ["complaint:read"] },
    { domain: "forensic", permissions: ["evidence:metadata-read"] },
    { domain: "knowledge", permissions: ["query:case-summary"] },
  ],
  mfa_verified: true,
  expires_at: "2026-07-01T19:30:00Z",
};

describe("platform app launcher", () => {
  it("renders API-provided pilot launch links and no links for planned or blocked modules", () => {
    const markup = renderToStaticMarkup(
      <AppLauncher apps={registryApps} registryVersion="platform.app_registry.v1" />,
    );

    expect(markup).toContain('href="/domains/dopams"');
    expect(markup).toContain('href="/domains/iqw"');
    expect(markup).toContain('href="/domains/forensic"');
    expect(markup).toContain('href="/domains/social-media"');
    expect(markup).toContain('href="/domains/knowledge"');
    expect(markup).toContain("Planned");
    expect(markup).toContain("Blocked");
  });

  it("keeps planned and blocked modules unavailable even if an unsafe URL appears", () => {
    const unsafePlannedApp = platformApp({
      id: "social-media",
      label: "Social Media Intelligence",
      module: "social_media",
      domain: "social_media",
      state: "planned",
      launch_url: "/domains/social-media",
      entitlement: { allowed: true, reason: "ALLOW", policy_version: "platform.entitlements.v1" },
      gateStatus: "pending",
      serverSideEnforced: false,
    });

    expect(launchUrlForDisplay(unsafePlannedApp)).toBeNull();
  });

  it("builds the route table from registry route availability", () => {
    const rows = moduleRouteRowsFromRegistry(registryApps);
    const activeRoutes = rows.filter((row) => row.routeStatus === "active").map((row) => row.routePath);
    const inactiveRows = rows.filter((row) => row.state === "planned" || row.state === "blocked");
    const markup = renderToStaticMarkup(<RouteTable apps={registryApps} />);

    expect(activeRoutes).toEqual([
      "/domains/dopams",
      "/domains/iqw",
      "/domains/forensic",
      "/domains/social-media",
      "/domains/knowledge",
    ]);
    inactiveRows.forEach((row) => expect(row.routePath).toBeNull());
    expect(markup).toContain("/domains/knowledge");
  });

  it("shows API entitlement and platform claim gate decisions in the audit panel", () => {
    const markup = renderToStaticMarkup(
      <DecisionAuditPanel apps={registryApps} me={me} registryVersion="platform.app_registry.v1" />,
    );

    expect(markup).toContain("Investigating Officer");
    expect(markup).toContain("platform.app_registry.v1");
    expect(markup).toContain("SERVER_SIDE_PLATFORM_CLAIMS_ENFORCED");
    expect(markup).toContain("P14-social-media-platform-auth-adapter");
    expect(markup).toContain("P15-knowledge-platform-auth-adapter");
  });
});

describe("platform API client", () => {
  it("loads session and app registry data from the platform API", async () => {
    const calls: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith("/api/v1/platform/me")) {
        return jsonResponse(me);
      }
      if (url.endsWith("/api/v1/platform/apps?limit=100")) {
        return jsonResponse({
          registry_version: "platform.app_registry.v1",
          apps: registryApps,
          pagination: { limit: 100, offset: 0, total: registryApps.length, next_offset: null },
        });
      }
      return new Response("not found", { status: 404 });
    };

    const data = await fetchPlatformShellData({ baseUrl: "http://platform.test/", fetchImpl });

    expect(calls).toEqual([
      "http://platform.test/api/v1/platform/me",
      "http://platform.test/api/v1/platform/apps?limit=100",
    ]);
    expect(data.registry.apps).toHaveLength(registryApps.length);
  });
});

interface PlatformAppFixture extends Partial<PlatformAppView> {
  id: string;
  label: string;
  module: string;
  domain: string;
  state: PlatformAppView["state"];
  gateStatus?: PlatformAppView["platform_claim_gate"]["status"];
  serverSideEnforced?: boolean;
  evidenceRef?: string;
}

function platformApp(input: PlatformAppFixture): PlatformAppView {
  return {
    description: `${input.label} module`,
    status_reason_code: input.state === "blocked" ? "APP_BLOCKED" : "PILOT_DOMAIN_GATE_PASSED",
    platform_claim_gate: {
      domain: input.domain,
      status: input.gateStatus ?? "passed",
      server_side_enforced: input.serverSideEnforced ?? true,
      evidence_ref: input.evidenceRef ?? `P7-${input.id}-evidence`,
      checked_at: "2026-07-02T00:00:00Z",
      reason_code:
        input.gateStatus === "pending"
          ? "SERVER_SIDE_PLATFORM_CLAIMS_PENDING"
          : "SERVER_SIDE_PLATFORM_CLAIMS_ENFORCED",
    },
    entitlement: {
      allowed: false,
      reason: "ENTITLEMENT_DENIED",
      policy_version: "platform.entitlements.v1",
    },
    ...input,
  };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
