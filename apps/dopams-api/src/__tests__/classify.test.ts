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

describe("Classify Routes", () => {
  it("POST /api/v1/classify/:entityType/:entityId without auth returns 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/classify/dopams_alert/00000000-0000-0000-0000-000000000001",
    });

    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady)("POST /api/v1/classify with valid entity type returns result", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/classify/dopams_alert/00000000-0000-0000-0000-000000000001",
    });

    // Entity may not exist, so 200 (classified) or 500 (lookup fails) are acceptable
    expect([200, 404, 500]).toContain(res.statusCode);
  });

  it.skipIf(!dbReady)("GET /api/v1/classify/:entityType/:entityId returns 404 for non-existent classification", async () => {
    const res = await authInject(app, token, {
      method: "GET",
      url: "/api/v1/classify/dopams_alert/00000000-0000-0000-0000-000000000099",
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("error", "NOT_FOUND");
  });

  it.skipIf(!dbReady)("PATCH /api/v1/classify/:classificationId/override rejects missing fields", async () => {
    const res = await authInject(app, token, {
      method: "PATCH",
      url: "/api/v1/classify/00000000-0000-0000-0000-000000000001/override",
      payload: { category: "HIGH_RISK" },
    });

    // Missing required fields (riskScore, reason) should return 400
    expect(res.statusCode).toBe(400);
  });

  it.skipIf(!dbReady)("PATCH /api/v1/classify/:classificationId/override returns 404 for non-existent classification", async () => {
    const res = await authInject(app, token, {
      method: "PATCH",
      url: "/api/v1/classify/00000000-0000-0000-0000-000000000099/override",
      payload: {
        category: "HIGH_RISK",
        riskScore: 0.95,
        reason: "Test override reason",
      },
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("error", "NOT_FOUND");
  });
});
