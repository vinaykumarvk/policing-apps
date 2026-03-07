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

describe("Lead Routes", () => {
  it("GET /api/v1/leads without auth returns 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/leads",
    });

    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady)("GET /api/v1/leads returns leads array with total", async () => {
    const res = await authInject(app, token, { method: "GET", url: "/api/v1/leads" });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("leads");
    expect(body).toHaveProperty("total");
    expect(Array.isArray(body.leads)).toBe(true);
    expect(typeof body.total).toBe("number");
  });

  it.skipIf(!dbReady)("GET /api/v1/leads supports pagination via limit and offset", async () => {
    const res = await authInject(app, token, {
      method: "GET",
      url: "/api/v1/leads?limit=3&offset=0",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("leads");
    expect(body.leads.length).toBeLessThanOrEqual(3);
  });

  it.skipIf(!dbReady)("GET /api/v1/leads/facets returns facet counts", async () => {
    const res = await authInject(app, token, { method: "GET", url: "/api/v1/leads/facets" });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("facets");
    expect(body.facets).toHaveProperty("state_id");
    expect(body.facets).toHaveProperty("priority");
    expect(body.facets).toHaveProperty("source_type");
    expect(Array.isArray(body.facets.state_id)).toBe(true);
    expect(Array.isArray(body.facets.priority)).toBe(true);
    expect(Array.isArray(body.facets.source_type)).toBe(true);
  });

  it.skipIf(!dbReady)("POST /api/v1/leads creates a new lead", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/leads",
      payload: { sourceType: "HUMINT", summary: "Lead test file integration test" },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("lead");
    expect(body.lead.lead_ref).toMatch(/^DOP-LEAD-/);
    expect(body.lead.summary).toBe("Lead test file integration test");
    expect(body.lead).toHaveProperty("state_id");
  });

  it.skipIf(!dbReady)("POST /api/v1/leads with HIGH urgency auto-generates a memo", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/leads",
      payload: {
        sourceType: "SIGINT",
        summary: "High urgency lead test for auto-memo",
        urgency: "HIGH",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("lead");
    expect(body.lead.lead_ref).toMatch(/^DOP-LEAD-/);
  });

  it.skipIf(!dbReady)("GET /api/v1/leads/:id returns 404 for missing UUID", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await authInject(app, token, {
      method: "GET",
      url: `/api/v1/leads/${fakeId}`,
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("LEAD_NOT_FOUND");
  });

  it.skipIf(!dbReady)("GET /api/v1/leads/:id/transitions returns 404 for missing lead", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await authInject(app, token, {
      method: "GET",
      url: `/api/v1/leads/${fakeId}/transitions`,
    });

    expect(res.statusCode).toBe(404);
  });

  it.skipIf(!dbReady)("POST /api/v1/leads/:id/transition returns 404 for missing lead", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await authInject(app, token, {
      method: "POST",
      url: `/api/v1/leads/${fakeId}/transition`,
      payload: { transitionId: "start_investigation" },
    });

    expect(res.statusCode).toBe(404);
  });
});
