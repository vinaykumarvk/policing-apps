import { expect, test, type APIRequestContext } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const composePath = path.join(root, "deploy/docker-compose/policing-platform.yml");
const nginxPath = path.join(root, "deploy/nginx/policing-platform.local.conf");
const liveBaseUrl = process.env.PLATFORM_PILOT_BASE_URL?.replace(/\/$/, "");

test("platform pilot local profile exposes only gated DOPAMS and IQW routes", async ({ request }) => {
  if (!liveBaseUrl) {
    assertStaticRouteContract();
    return;
  }

  await expectStatus(request, "/api/v1/platform/health", 200);
  const registryResponse = await expectStatus(request, "/api/v1/platform/apps?limit=100", 200);
  const registry = await registryResponse.json();
  const apps = new Map<string, { state: string; launch_url?: string }>(
    registry.apps.map((app: { id: string; state: string; launch_url?: string }) => [app.id, app]),
  );

  expect(apps.get("dopams")).toMatchObject({ state: "pilot", launch_url: "/domains/dopams" });
  expect(apps.get("iqw")).toMatchObject({ state: "pilot", launch_url: "/domains/iqw" });
  expect(apps.get("forensic")).toMatchObject({ state: "planned" });
  expect(apps.get("social-media")).toMatchObject({ state: "planned" });
  expect(apps.get("knowledge")).toMatchObject({ state: "blocked" });
  expect(apps.get("forensic")?.launch_url).toBeUndefined();
  expect(apps.get("social-media")?.launch_url).toBeUndefined();
  expect(apps.get("knowledge")?.launch_url).toBeUndefined();

  await expectStatus(request, "/domains/dopams/health", 200);
  await expectStatus(request, "/domains/iqw/health", 200);
  await expectStatus(request, "/domains/forensic/health", 404);
  await expectStatus(request, "/domains/social-media/health", 404);
  await expectStatus(request, "/domains/knowledge/health", 404);
});

async function expectStatus(request: APIRequestContext, pathName: string, expectedStatus: number) {
  const response = await request.get(`${liveBaseUrl}${pathName}`);
  expect(response.status(), pathName).toBe(expectedStatus);
  return response;
}

function assertStaticRouteContract(): void {
  const compose = fs.readFileSync(composePath, "utf8");
  const nginx = fs.readFileSync(nginxPath, "utf8");

  expect(compose).toContain("platform-web");
  expect(compose).toContain("platform-api");
  expect(compose).toContain("dopams-api");
  expect(compose).toContain("iqw-api");
  expect(compose).toContain("pgvector/pgvector");
  expect(compose).toContain("redis-queue");
  expect(compose).toContain("object-storage");

  expect(nginx).toMatch(/location \^~ \/domains\/dopams\//);
  expect(nginx).toMatch(/location \^~ \/domains\/iqw\//);
  expect(nginx).toContain("PLATFORM_ROUTE_BLOCKED");
  expect(nginx).toContain('"planned":["social-media","forensic"]');
  expect(nginx).toContain('"blocked":["knowledge"]');
  expect(nginx).not.toMatch(/proxy_pass\s+http:\/\/(social|forensic|knowledge)/i);
}
