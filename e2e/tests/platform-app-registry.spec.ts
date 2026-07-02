import { expect, test } from "@playwright/test";

const me = {
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
  modules: ["dopams", "iqw"],
  domain_permissions: [
    { domain: "dopams", permissions: ["case:read"] },
    { domain: "iqw", permissions: ["complaint:read"] },
  ],
  mfa_verified: true,
  expires_at: "2026-07-01T19:30:00Z",
};

const registry = {
  registry_version: "platform.app_registry.v1",
  pagination: { limit: 100, offset: 0, total: 4, next_offset: null },
  apps: [
    app("dopams", "DOPAMS", "dopams", "pilot", "/domains/dopams", "ALLOW"),
    app("iqw", "IQW Intake", "iqw", "pilot", "/domains/iqw", "ALLOW"),
    app("forensic", "Forensic Lab", "forensic", "planned", undefined, "NO_ENTITLEMENT_REQUEST"),
    app("knowledge", "Knowledge Search", "knowledge", "blocked", undefined, "NO_ENTITLEMENT_REQUEST"),
  ],
};

test("platform app registry exposes only pilot-gated DOPAMS and IQW launch links", async ({ page }) => {
  await page.route("**/api/v1/platform/me", async (route) => route.fulfill({ json: me }));
  await page.route("**/api/v1/platform/apps?limit=100", async (route) => route.fulfill({ json: registry }));

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Entitled modules" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open DOPAMS" })).toHaveAttribute("href", "/domains/dopams");
  await expect(page.getByRole("link", { name: "Open IQW Intake" })).toHaveAttribute("href", "/domains/iqw");
  await expect(page.getByRole("link", { name: /Forensic Lab/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Knowledge Search/ })).toHaveCount(0);
  await expect(page.locator('[data-state="planned"]').first()).toContainText("Planned");
  await expect(page.locator('[data-state="blocked"]').first()).toContainText("Blocked");
});

function app(
  id: string,
  label: string,
  domain: string,
  state: "pilot" | "planned" | "blocked",
  launchUrl: string | undefined,
  entitlementReason: string,
) {
  return {
    id,
    label,
    module: domain,
    domain,
    state,
    description: `${label} registry entry`,
    status_reason_code: state === "pilot" ? "PILOT_DOMAIN_GATE_PASSED" : "NO_LAUNCH_URL_CONFIGURED",
    platform_claim_gate: {
      domain,
      status: state === "pilot" ? "passed" : state === "planned" ? "pending" : "failed",
      server_side_enforced: state === "pilot",
      evidence_ref: `P7-${id}-evidence`,
      checked_at: "2026-07-02T00:00:00Z",
      reason_code:
        state === "pilot" ? "SERVER_SIDE_PLATFORM_CLAIMS_ENFORCED" : "SERVER_SIDE_PLATFORM_CLAIMS_PENDING",
    },
    entitlement: {
      allowed: entitlementReason === "ALLOW",
      reason: entitlementReason,
      policy_version: "platform.entitlements.v1",
    },
    ...(launchUrl ? { launch_url: launchUrl } : { launch_block_reason: "NO_LAUNCH_URL_CONFIGURED" }),
  };
}
