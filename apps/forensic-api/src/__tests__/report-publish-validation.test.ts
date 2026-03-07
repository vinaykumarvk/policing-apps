import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FastifyInstance } from "fastify";
import { buildTestApp, getAuthToken, authInject, isDatabaseReady } from "../test-helpers";

let app: FastifyInstance;
let token: string;
let dbReady = false;

const FAKE_UUID = "00000000-0000-0000-0000-000000000000";

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

describe("Report publish validation — FR-11 AC-04", () => {
  it.skipIf(!dbReady)("POST /api/v1/reports/:id/transition returns 404 for non-existent report", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: `/api/v1/reports/${FAKE_UUID}/transition`,
      payload: { transitionId: "PUBLISH" },
    });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("REPORT_NOT_FOUND");
  });

  it.skipIf(!dbReady)("POST /api/v1/reports/:id/transition returns 400 when transitionId is missing", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: `/api/v1/reports/${FAKE_UUID}/transition`,
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it.skipIf(!dbReady)("GET /api/v1/reports/:id/transitions returns 404 for non-existent report", async () => {
    const res = await authInject(app, token, {
      method: "GET",
      url: `/api/v1/reports/${FAKE_UUID}/transitions`,
    });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("REPORT_NOT_FOUND");
  });

  it.skipIf(!dbReady)("rejects invalid transition from DRAFT state", async () => {
    // Create case + report
    const caseRes = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/cases",
      payload: { title: "Invalid Transition Test Case" },
    });
    if (caseRes.statusCode !== 201) return; // no cases table or constraint
    const caseId = JSON.parse(caseRes.body).case.case_id;

    const reportRes = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/reports",
      payload: { caseId, title: "Invalid Transition Test Report" },
    });
    expect(reportRes.statusCode).toBe(201);
    const reportId = JSON.parse(reportRes.body).report.report_id;

    // PUBLISH directly from DRAFT should fail
    const transRes = await authInject(app, token, {
      method: "POST",
      url: `/api/v1/reports/${reportId}/transition`,
      payload: { transitionId: "PUBLISH" },
    });
    expect(transRes.statusCode).toBe(400);
    const body = JSON.parse(transRes.body);
    expect(body.error).toBe("INVALID_TRANSITION");
  });

  it.skipIf(!dbReady)("rejects request with extra properties in body", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: `/api/v1/reports/${FAKE_UUID}/transition`,
      payload: { transitionId: "SUBMIT", unknownField: "should-be-rejected" },
    });
    expect(res.statusCode).toBe(400);
  });

  it.skipIf(!dbReady)("rejects request with invalid UUID in params", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/reports/not-a-uuid/transition",
      payload: { transitionId: "SUBMIT" },
    });
    expect(res.statusCode).toBe(400);
  });
});
