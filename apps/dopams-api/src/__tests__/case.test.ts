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

describe("Case Routes", () => {
  it("GET /api/v1/cases without auth returns 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/cases",
    });

    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady)("GET /api/v1/cases returns cases array with total", async () => {
    const res = await authInject(app, token, { method: "GET", url: "/api/v1/cases" });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("cases");
    expect(body).toHaveProperty("total");
    expect(Array.isArray(body.cases)).toBe(true);
    expect(typeof body.total).toBe("number");
  });

  it.skipIf(!dbReady)("GET /api/v1/cases supports pagination via limit and offset", async () => {
    const res = await authInject(app, token, {
      method: "GET",
      url: "/api/v1/cases?limit=2&offset=0",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("cases");
    expect(body.cases.length).toBeLessThanOrEqual(2);
  });

  it.skipIf(!dbReady)("GET /api/v1/cases/facets returns facet counts", async () => {
    const res = await authInject(app, token, { method: "GET", url: "/api/v1/cases/facets" });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("facets");
    expect(body.facets).toHaveProperty("state_id");
    expect(body.facets).toHaveProperty("priority");
    expect(Array.isArray(body.facets.state_id)).toBe(true);
    expect(Array.isArray(body.facets.priority)).toBe(true);
  });

  it.skipIf(!dbReady)("POST /api/v1/cases creates a new case", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/cases",
      payload: { title: "Case test file integration test" },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("case");
    expect(body.case.case_number).toMatch(/^DOP-CASE-/);
    expect(body.case.title).toBe("Case test file integration test");
    expect(body.case).toHaveProperty("state_id");
  });

  it.skipIf(!dbReady)("GET /api/v1/cases/:id returns 404 for missing UUID", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await authInject(app, token, {
      method: "GET",
      url: `/api/v1/cases/${fakeId}`,
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("CASE_NOT_FOUND");
  });

  it.skipIf(!dbReady)("GET /api/v1/cases/:id/transitions returns 404 for missing case", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await authInject(app, token, {
      method: "GET",
      url: `/api/v1/cases/${fakeId}/transitions`,
    });

    expect(res.statusCode).toBe(404);
  });

  it.skipIf(!dbReady)("POST /api/v1/cases/:id/transition returns 404 for missing case", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await authInject(app, token, {
      method: "POST",
      url: `/api/v1/cases/${fakeId}/transition`,
      payload: { transitionId: "start_investigation" },
    });

    expect(res.statusCode).toBe(404);
  });
});
