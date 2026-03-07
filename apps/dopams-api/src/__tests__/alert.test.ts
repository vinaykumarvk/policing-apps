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

describe("Alert Routes", () => {
  it("GET /api/v1/alerts without auth returns 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/alerts",
    });

    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady)("GET /api/v1/alerts returns alerts array with total", async () => {
    const res = await authInject(app, token, { method: "GET", url: "/api/v1/alerts" });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("alerts");
    expect(body).toHaveProperty("total");
    expect(Array.isArray(body.alerts)).toBe(true);
    expect(typeof body.total).toBe("number");
  });

  it.skipIf(!dbReady)("GET /api/v1/alerts supports pagination via limit and offset", async () => {
    const res = await authInject(app, token, {
      method: "GET",
      url: "/api/v1/alerts?limit=5&offset=0",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("alerts");
    expect(body.alerts.length).toBeLessThanOrEqual(5);
  });

  it.skipIf(!dbReady)("GET /api/v1/alerts/facets returns facet counts", async () => {
    const res = await authInject(app, token, { method: "GET", url: "/api/v1/alerts/facets" });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("facets");
    expect(body.facets).toHaveProperty("state_id");
    expect(body.facets).toHaveProperty("severity");
    expect(body.facets).toHaveProperty("alert_type");
    expect(Array.isArray(body.facets.state_id)).toBe(true);
    expect(Array.isArray(body.facets.severity)).toBe(true);
    expect(Array.isArray(body.facets.alert_type)).toBe(true);
  });

  it.skipIf(!dbReady)("GET /api/v1/alerts/:id returns 404 for missing UUID", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await authInject(app, token, {
      method: "GET",
      url: `/api/v1/alerts/${fakeId}`,
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("ALERT_NOT_FOUND");
  });

  it.skipIf(!dbReady)("GET /api/v1/alerts/:id/transitions returns 404 for missing alert", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await authInject(app, token, {
      method: "GET",
      url: `/api/v1/alerts/${fakeId}/transitions`,
    });

    expect(res.statusCode).toBe(404);
  });

  it.skipIf(!dbReady)("POST /api/v1/alerts/:id/transition returns 404 for missing alert", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await authInject(app, token, {
      method: "POST",
      url: `/api/v1/alerts/${fakeId}/transition`,
      payload: { transitionId: "acknowledge" },
    });

    expect(res.statusCode).toBe(404);
  });
});

describe("Alert Suppression Rules", () => {
  it("GET /api/v1/alert-suppression-rules without auth returns 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/alert-suppression-rules",
    });

    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady)("GET /api/v1/alert-suppression-rules returns rules array", async () => {
    const res = await authInject(app, token, {
      method: "GET",
      url: "/api/v1/alert-suppression-rules",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("rules");
    expect(Array.isArray(body.rules)).toBe(true);
  });

  it.skipIf(!dbReady)("POST /api/v1/alerts/check-suppression returns suppression status", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/alerts/check-suppression",
      payload: { alertType: "TEST_TYPE", severity: "LOW" },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("suppressed");
    expect(typeof body.suppressed).toBe("boolean");
  });

  it.skipIf(!dbReady)("DELETE /api/v1/alert-suppression-rules/:ruleId returns 404 for missing rule", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await authInject(app, token, {
      method: "DELETE",
      url: `/api/v1/alert-suppression-rules/${fakeId}`,
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("RULE_NOT_FOUND");
  });
});
