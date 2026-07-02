import { describe, expect, it } from "vitest";
import { createPlatformApp } from "../app";
import type { PlatformHealthCheck } from "../routes/platform.routes";

interface HealthResponse {
  status: string;
  reason_codes: string[];
  checks: Array<{
    name: string;
    status: string;
    reason_code: string;
    required: boolean;
  }>;
}

interface ReadinessResponse extends HealthResponse {
  ready: boolean;
}

describe("platform health and readiness routes", () => {
  it("reports degraded required checks with actionable reason codes and fails readiness", async () => {
    const degradedCheck: PlatformHealthCheck = {
      name: "projection-store",
      required: true,
      run: () => ({
        name: "projection-store",
        status: "degraded",
        reason_code: "PROJECTION_STORE_STALE",
        detail: "latest projection freshness check exceeded the configured threshold",
        required: true,
      }),
    };
    const app = createPlatformApp({ healthChecks: [degradedCheck] });

    const healthResponse = await app.handle(new Request("http://platform.test/health"));
    const health = (await healthResponse.json()) as HealthResponse;
    expect(healthResponse.status).toBe(200);
    expect(health.status).toBe("degraded");
    expect(health.reason_codes).toContain("PROJECTION_STORE_STALE");
    expect(health.checks.map((check) => check.name)).toContain("app-registry");

    const readinessResponse = await app.handle(new Request("http://platform.test/ready"));
    const ready = (await readinessResponse.json()) as ReadinessResponse;
    expect(readinessResponse.status).toBe(503);
    expect(ready.ready).toBe(false);
    expect(ready.reason_codes).toContain("PROJECTION_STORE_STALE");
  });
});
