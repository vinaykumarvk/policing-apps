import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, getAuthToken, authInject } from "../test-helpers";

let app: any;
let token: string;
let dbReady = false;

beforeAll(async () => {
  app = await buildTestApp();
  const t = await getAuthToken(app);
  if (t) { token = t; dbReady = true; }
});
afterAll(async () => { await app.close(); });

describe("Dashboard — GET /api/v1/dashboard/stats", () => {
  it("returns dashboard statistics", async () => {
    if (!dbReady) return;
    const res = await authInject(app, token, "GET", "/api/v1/dashboard/stats");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.casesByState).toBeInstanceOf(Array);
    expect(body.casesByType).toBeInstanceOf(Array);
    expect(typeof body.totalEvidence).toBe("number");
    expect(typeof body.pendingFindings).toBe("number");
    expect(typeof body.draftReports).toBe("number");
    expect(body.recentCases).toBeInstanceOf(Array);
  });

  it("supports date filter parameters", async () => {
    if (!dbReady) return;
    const res = await authInject(
      app, token, "GET",
      "/api/v1/dashboard/stats?dateFrom=2024-01-01&dateTo=2026-12-31",
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.casesByState).toBeInstanceOf(Array);
  });

  it("supports status filter parameter", async () => {
    if (!dbReady) return;
    const res = await authInject(
      app, token, "GET",
      "/api/v1/dashboard/stats?status=OPEN",
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.casesByState).toBeDefined();
  });

  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/dashboard/stats",
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("Scheduled Reports — GET /api/v1/reports/scheduled", () => {
  it("returns scheduled reports array", async () => {
    if (!dbReady) return;
    const res = await authInject(app, token, "GET", "/api/v1/reports/scheduled");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.scheduledReports).toBeInstanceOf(Array);
  });

  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/reports/scheduled",
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("Scheduled Reports — POST /api/v1/reports/scheduled", () => {
  it("creates a scheduled report", async () => {
    if (!dbReady) return;
    const res = await authInject(app, token, "POST", "/api/v1/reports/scheduled", {
      reportType: "MONTHLY_MIS",
      reportName: "Test Monthly MIS Report",
      cronExpression: "0 0 1 * *",
      config: { includeCharts: true },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.scheduledReport).toBeDefined();
    expect(body.scheduledReport.report_name).toBe("Test Monthly MIS Report");
    expect(body.scheduledReport.cron_expression).toBe("0 0 1 * *");
    expect(body.scheduledReport.is_active).toBe(true);
  });

  it("returns 400 when required fields are missing", async () => {
    if (!dbReady) return;
    const res = await authInject(app, token, "POST", "/api/v1/reports/scheduled", {
      reportType: "MONTHLY_MIS",
    });
    expect(res.statusCode).toBe(400);
  });
});
