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

describe("Dashboard Routes", () => {
  it("GET /api/v1/dashboard/stats without auth returns 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/dashboard/stats",
    });

    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady)("GET /api/v1/dashboard/stats returns stats object", async () => {
    const res = await authInject(app, token, { method: "GET", url: "/api/v1/dashboard/stats" });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("alertsBySeverity");
    expect(body).toHaveProperty("leadsByState");
    expect(body).toHaveProperty("totalCases");
    expect(body).toHaveProperty("totalSubjects");
    expect(body).toHaveProperty("recentAlerts");
    expect(Array.isArray(body.alertsBySeverity)).toBe(true);
    expect(Array.isArray(body.leadsByState)).toBe(true);
    expect(typeof body.totalCases).toBe("number");
    expect(typeof body.totalSubjects).toBe("number");
  });
});

describe("Scheduled Reports Routes", () => {
  it("GET /api/v1/reports/scheduled without auth returns 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/reports/scheduled",
    });

    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady)("GET /api/v1/reports/scheduled returns scheduled reports array", async () => {
    const res = await authInject(app, token, { method: "GET", url: "/api/v1/reports/scheduled" });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("scheduledReports");
    expect(Array.isArray(body.scheduledReports)).toBe(true);
  });

  it.skipIf(!dbReady)("POST /api/v1/reports/scheduled creates a scheduled report", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/reports/scheduled",
      payload: {
        reportType: "MONTHLY_SUMMARY",
        reportName: `Test Scheduled Report ${Date.now()}`,
        cronExpression: "0 9 1 * *",
        config: { format: "PDF" },
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("scheduledReport");
    expect(body.scheduledReport).toHaveProperty("report_id");
    expect(body.scheduledReport.report_type).toBe("MONTHLY_SUMMARY");
  });

  it.skipIf(!dbReady)("POST /api/v1/reports/scheduled rejects missing required fields", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/reports/scheduled",
      payload: {
        reportType: "MONTHLY_SUMMARY",
        // missing reportName and cronExpression
      },
    });

    expect(res.statusCode).toBe(400);
  });
});
