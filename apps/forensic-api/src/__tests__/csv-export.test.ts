import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  buildTestApp,
  getAuthToken,
  authInject,
} from "../test-helpers";

let app: any;
let token: string;
let dbReady = false;

beforeAll(async () => {
  app = await buildTestApp();
  const t = await getAuthToken(app);
  if (t) {
    token = t;
    dbReady = true;
  }
});

afterAll(async () => {
  await app.close();
});

/* ------------------------------------------------------------------ */
/*  CSV Export — FR-15                                                  */
/* ------------------------------------------------------------------ */

describe("CSV Export — GET /api/v1/dashboard/stats?format=csv", () => {
  it("returns text/csv content type", async () => {
    if (!dbReady) return;

    const res = await authInject(
      app,
      token,
      "GET",
      "/api/v1/dashboard/stats?format=csv",
    );
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.headers["content-disposition"]).toContain("attachment");
    expect(res.headers["content-disposition"]).toContain("dashboard-stats.csv");

    // Verify CSV structure — first line should be the header
    const csvContent = res.payload;
    expect(csvContent).toContain("Section,Key,Value");
  });

  it("returns JSON by default when no format is specified", async () => {
    if (!dbReady) return;

    const res = await authInject(
      app,
      token,
      "GET",
      "/api/v1/dashboard/stats",
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.casesByState).toBeInstanceOf(Array);
    expect(body.casesByType).toBeInstanceOf(Array);
    expect(typeof body.totalEvidence).toBe("number");
    expect(typeof body.pendingFindings).toBe("number");
    expect(typeof body.draftReports).toBe("number");
    expect(body.recentCases).toBeInstanceOf(Array);
  });

  it("returns JSON when format=json is specified", async () => {
    if (!dbReady) return;

    const res = await authInject(
      app,
      token,
      "GET",
      "/api/v1/dashboard/stats?format=json",
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.casesByState).toBeInstanceOf(Array);
  });

  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/dashboard/stats?format=csv",
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("CSV Export — GET /api/v1/reports/scheduled?format=csv", () => {
  it("returns text/csv content type", async () => {
    if (!dbReady) return;

    const res = await authInject(
      app,
      token,
      "GET",
      "/api/v1/reports/scheduled?format=csv",
    );
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.headers["content-disposition"]).toContain("attachment");
    expect(res.headers["content-disposition"]).toContain("scheduled-reports.csv");

    // Verify CSV header row
    const csvContent = res.payload;
    expect(csvContent).toContain("Report ID");
    expect(csvContent).toContain("Report Type");
    expect(csvContent).toContain("Report Name");
  });

  it("returns JSON by default when no format is specified", async () => {
    if (!dbReady) return;

    const res = await authInject(
      app,
      token,
      "GET",
      "/api/v1/reports/scheduled",
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.scheduledReports).toBeInstanceOf(Array);
  });

  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/reports/scheduled?format=csv",
    });
    expect(res.statusCode).toBe(401);
  });
});
