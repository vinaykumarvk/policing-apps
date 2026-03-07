/**
 * Integration tests for Social Media API dashboard routes.
 * Covers: dashboard stats, control room queue, scheduled reports CRUD.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, getAuthToken, authInject, isDatabaseReady, SEED_USERS, NON_EXISTENT_UUID } from "../test-helpers";
import { FastifyInstance } from "fastify";

describe("Social Media API — Dashboard", () => {
  let app: FastifyInstance;
  let token: string;
  let dbReady = false;

  beforeAll(async () => {
    app = await buildTestApp();
    dbReady = await isDatabaseReady(app);
    if (dbReady) {
      token = (await getAuthToken(app, SEED_USERS.admin.username, SEED_USERS.admin.password))!;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/v1/dashboard/stats without auth returns 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/dashboard/stats" });
    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady)("GET /api/v1/dashboard/stats returns aggregated stats", async () => {
    const res = await authInject(app, token, "GET", "/api/v1/dashboard/stats");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.alertsByState)).toBe(true);
    expect(typeof body.totalCases).toBe("number");
    expect(typeof body.totalContent).toBe("number");
    expect(typeof body.activeWatchlists).toBe("number");
    expect(Array.isArray(body.recentAlerts)).toBe(true);
  });

  it.skipIf(!dbReady)("GET /api/v1/dashboard/control-room returns queue with SLA info", async () => {
    const res = await authInject(app, token, "GET", "/api/v1/dashboard/control-room");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.queue)).toBe(true);
    expect(typeof body.total).toBe("number");
    expect(body.timestamp).toBeDefined();
  });

  it.skipIf(!dbReady)("GET /api/v1/dashboard/control-room supports priority filter", async () => {
    const res = await authInject(app, token, "GET", "/api/v1/dashboard/control-room?priority=CRITICAL&limit=10");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.queue)).toBe(true);
    // All returned items should have CRITICAL priority if any exist
    for (const item of body.queue) {
      expect(item.priority).toBe("CRITICAL");
    }
  });

  it.skipIf(!dbReady)("GET /api/v1/reports/scheduled returns scheduled reports list", async () => {
    const res = await authInject(app, token, "GET", "/api/v1/reports/scheduled");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.scheduledReports)).toBe(true);
  });

  it.skipIf(!dbReady)("POST /api/v1/reports/scheduled creates a scheduled report", async () => {
    const res = await authInject(app, token, "POST", "/api/v1/reports/scheduled", {
      reportType: "WEEKLY_SUMMARY",
      reportName: "Test Scheduled Report " + Date.now(),
      cronExpression: "0 9 * * MON",
      config: { includeCharts: true },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.scheduledReport).toBeDefined();
    expect(body.scheduledReport.report_type).toBe("WEEKLY_SUMMARY");
    expect(body.scheduledReport.report_id).toBeDefined();
  });

  it.skipIf(!dbReady)("PATCH /api/v1/reports/scheduled/:reportId with non-existent ID returns 404", async () => {
    const res = await authInject(app, token, "PATCH", `/api/v1/reports/scheduled/${NON_EXISTENT_UUID}`, {
      isActive: false,
    });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("NOT_FOUND");
  });
});
