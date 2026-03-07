import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FastifyInstance } from "fastify";
import { buildTestApp, getAuthToken, isDatabaseReady, authInject } from "../test-helpers";

let app: FastifyInstance;
let token: string;
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

describe("Monthly Report Routes", () => {
  it("GET /api/v1/monthly-reports without auth returns 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/monthly-reports",
    });

    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady)("GET /api/v1/monthly-reports returns reports array", async () => {
    const res = await authInject(app, token, { method: "GET", url: "/api/v1/monthly-reports" });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("reports");
    expect(Array.isArray(body.reports)).toBe(true);
    expect(body).toHaveProperty("total");
  });

  it.skipIf(!dbReady)("POST /api/v1/monthly-reports/generate creates a report", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/monthly-reports/generate",
      payload: { month: "2026-01" },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("report");
  });

  it.skipIf(!dbReady)("GET /api/v1/kpis returns KPI definitions", async () => {
    const res = await authInject(app, token, { method: "GET", url: "/api/v1/kpis" });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("kpis");
    expect(Array.isArray(body.kpis)).toBe(true);
  });
});
