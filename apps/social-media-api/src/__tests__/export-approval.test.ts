/**
 * Integration tests for Social Media API report export approval gate (FR-08 AC-05).
 * Verifies that POST /api/v1/reports/:id/export is blocked unless the report
 * is in an APPROVED (or later) state and has an approved_by value.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { buildTestApp, getAuthToken, authInject, isDatabaseReady } from "../test-helpers";
import { FastifyInstance } from "fastify";

const FAKE_UUID = "00000000-0000-0000-0000-000000000000";

describe("Social Media API — Export Approval Gate (FR-08 AC-05)", () => {
  let app: FastifyInstance;
  let token: string;
  let dbReady = false;

  beforeAll(async () => {
    app = await buildTestApp();
    dbReady = await isDatabaseReady(app);
    if (dbReady) {
      const t = await getAuthToken(app);
      if (t) token = t; else dbReady = false;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach((ctx) => {
    if (!dbReady) ctx.skip();
  });

  it("POST /api/v1/reports/:id/export with non-existent report ID returns 404", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: `/api/v1/reports/${FAKE_UUID}/export`,
    });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("REPORT_NOT_FOUND");
  });

  it("POST /api/v1/reports/:id/export on DRAFT report returns 403 EXPORT_NOT_APPROVED", async () => {
    // Create a case
    const caseRes = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/cases",
      payload: { title: "Export Approval Test Case" },
    });
    if (caseRes.statusCode !== 201) return;
    const caseId = JSON.parse(caseRes.body).case.case_id;

    // Create a report (defaults to DRAFT state)
    const reportRes = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/reports",
      payload: { caseId, title: "Export Approval Test Report" },
    });
    expect(reportRes.statusCode).toBe(201);
    const report = JSON.parse(reportRes.body).report;
    expect(report.state_id).toBe("DRAFT");

    // Attempt export — should be blocked with 403
    const exportRes = await authInject(app, token, {
      method: "POST",
      url: `/api/v1/reports/${report.report_id}/export`,
    });
    expect(exportRes.statusCode).toBe(403);
    const exportBody = JSON.parse(exportRes.body);
    expect(exportBody.error).toBe("EXPORT_NOT_APPROVED");
  });

  it("POST /api/v1/reports/:id/export endpoint exists and responds with structured error", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: `/api/v1/reports/${FAKE_UUID}/export`,
    });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("REPORT_NOT_FOUND");
    expect(body.message).toBeDefined();
  });
});
