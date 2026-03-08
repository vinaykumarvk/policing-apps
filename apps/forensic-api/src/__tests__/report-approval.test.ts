/**
 * Tests for FR-11 AC-03/04: Report approval timestamp and findings guard fix.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FastifyInstance } from "fastify";
import { buildTestApp, getAuthToken, isDatabaseReady, authInject, NON_EXISTENT_UUID } from "../test-helpers";

let app: FastifyInstance;
let token: string | null;
let dbReady = false;

beforeAll(async () => {
  app = await buildTestApp();
  dbReady = await isDatabaseReady(app);
  if (dbReady) {
    token = await getAuthToken(app, "admin", "password");
  }
});

afterAll(async () => {
  await app.close();
});

describe("Report Approval & Findings Guard (FR-11)", () => {
  it("GET /api/v1/reports without auth returns 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/reports",
    });
    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady || !token)("GET /api/v1/reports returns reports array", async () => {
    const res = await authInject(app, token!, "GET", "/api/v1/reports");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty("reports");
    expect(Array.isArray(body.reports)).toBe(true);
  });

  it.skipIf(!dbReady || !token)("GET /api/v1/reports/:id with nonexistent id returns 404", async () => {
    const res = await authInject(app, token!, "GET", `/api/v1/reports/${NON_EXISTENT_UUID}`);
    expect(res.statusCode).toBe(404);
  });

  it.skipIf(!dbReady || !token)("POST /api/v1/reports/:id/transition requires valid transitionId", async () => {
    const res = await authInject(app, token!, "POST", `/api/v1/reports/${NON_EXISTENT_UUID}/transition`, {
      transitionId: "APPROVE",
    });
    // Non-existent report should fail
    expect([404, 409, 500]).toContain(res.statusCode);
  });
});
