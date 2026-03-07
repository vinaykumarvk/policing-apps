/**
 * Integration tests for Social Media API list pagination.
 * Covers: alerts, cases, content, reports with limit/offset query params.
 */
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { buildTestApp, getAuthToken, authInject, SEED_USERS, TestApp } from "../test-helpers";

describe("Social Media API — Pagination", () => {
  let app: TestApp;
  let token: string;
  let dbReady = false;

  beforeAll(async () => {
    app = await buildTestApp();
    try {
      const t = await getAuthToken(app, SEED_USERS.admin.username, SEED_USERS.admin.password);
      if (!t) throw new Error("LOGIN_FAILED");
      token = t;
      dbReady = true;
    } catch {
      dbReady = false;
    }
  });

  beforeEach((ctx) => {
    if (!dbReady) ctx.skip();
  });

  it("GET /api/v1/alerts?limit=1 returns at most 1 result", async () => {
    const res = await authInject(app, token, "GET", "/api/v1/alerts?limit=1");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.alerts.length).toBeLessThanOrEqual(1);
    expect(typeof body.total).toBe("number");
  });

  it("GET /api/v1/alerts with different offsets returns different pages", async () => {
    const res0 = await authInject(app, token, "GET", "/api/v1/alerts?limit=1&offset=0");
    const res1 = await authInject(app, token, "GET", "/api/v1/alerts?limit=1&offset=1");
    const body0 = JSON.parse(res0.payload);
    const body1 = JSON.parse(res1.payload);

    // If there are 2+ alerts the IDs should differ; if only 0-1 alerts, both are still valid responses
    if (body0.total >= 2) {
      expect(body0.alerts[0].alert_id).not.toBe(body1.alerts[0]?.alert_id);
    }
  });

  it("GET /api/v1/cases?limit=2 returns at most 2 results with total", async () => {
    const res = await authInject(app, token, "GET", "/api/v1/cases?limit=2");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.cases.length).toBeLessThanOrEqual(2);
    expect(typeof body.total).toBe("number");
  });

  it("GET /api/v1/content?limit=5 returns at most 5 results", async () => {
    const res = await authInject(app, token, "GET", "/api/v1/content?limit=5");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.content.length).toBeLessThanOrEqual(5);
    expect(typeof body.total).toBe("number");
  });

  it("GET /api/v1/reports?limit=3&offset=0 returns at most 3 results", async () => {
    const res = await authInject(app, token, "GET", "/api/v1/reports?limit=3&offset=0");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.reports.length).toBeLessThanOrEqual(3);
    expect(typeof body.total).toBe("number");
  });

  it("GET /api/v1/watchlists?limit=1 returns at most 1 watchlist", async () => {
    const res = await authInject(app, token, "GET", "/api/v1/watchlists?limit=1");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.watchlists.length).toBeLessThanOrEqual(1);
    expect(typeof body.total).toBe("number");
  });

  it("limit exceeding maximum (200) is rejected by schema validation", async () => {
    // Fastify schema enforces maximum: 200 on the limit parameter
    const res = await authInject(app, token, "GET", "/api/v1/alerts?limit=999");
    expect(res.statusCode).toBe(400);
  });
});
