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

describe("eCourts Routes", () => {
  it("GET /api/v1/court-cases without auth returns 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/court-cases",
    });

    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady)("GET /api/v1/court-cases returns court cases array", async () => {
    const res = await authInject(app, token, { method: "GET", url: "/api/v1/court-cases" });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("courtCases");
    expect(Array.isArray(body.courtCases)).toBe(true);
    expect(body).toHaveProperty("total");
  });

  it.skipIf(!dbReady)("POST /api/v1/court-cases creates a court case entry", async () => {
    const cnr = `CNR-TEST-${Date.now()}`;
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/court-cases",
      payload: {
        cnrNumber: cnr,
        caseNumber: "CC/2026/001",
        courtName: "District Court, Test",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("courtCase");
    expect(body.courtCase.cnr_number).toBe(cnr);
  });

  it.skipIf(!dbReady)("GET /api/v1/court-cases/:id returns 404 for missing UUID", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await authInject(app, token, {
      method: "GET",
      url: `/api/v1/court-cases/${fakeId}`,
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("COURT_CASE_NOT_FOUND");
  });
});
