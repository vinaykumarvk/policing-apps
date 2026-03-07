/**
 * Integration tests for Social Media API classification routes.
 * Covers: POST classify entity, GET classification, PATCH override.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, getAuthToken, authInject, isDatabaseReady, SEED_USERS, NON_EXISTENT_UUID } from "../test-helpers";
import { FastifyInstance } from "fastify";

describe("Social Media API — Classify", () => {
  let app: FastifyInstance;
  let token: string;
  let dbReady = false;

  beforeAll(async () => {
    app = await buildTestApp();
    dbReady = await isDatabaseReady(app);
    if (dbReady) {
      token = (await getAuthToken(app, SEED_USERS.admin.username, SEED_USERS.admin.password))!;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it("POST /api/v1/classify/sm_alert/:id without auth returns 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/classify/sm_alert/${NON_EXISTENT_UUID}`,
    });
    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady)("GET /api/v1/classify/sm_alert/:id with non-existent entity returns 404 or empty", async () => {
    const res = await authInject(app, token, "GET", `/api/v1/classify/sm_alert/${NON_EXISTENT_UUID}`);
    // No classification exists for a non-existent entity
    expect([404, 200]).toContain(res.statusCode);
    if (res.statusCode === 404) {
      const body = JSON.parse(res.payload);
      expect(body.error).toBe("NOT_FOUND");
    }
  });

  it.skipIf(!dbReady)("POST /api/v1/classify with invalid entityType is rejected by schema", async () => {
    const res = await authInject(app, token, "POST", `/api/v1/classify/invalid_type/${NON_EXISTENT_UUID}`);
    // Schema enum validation rejects entity types other than sm_alert, sm_case, sm_evidence
    expect(res.statusCode).toBe(400);
  });

  it.skipIf(!dbReady)("PATCH /api/v1/classify/:classificationId/override with non-existent ID returns 404", async () => {
    const res = await authInject(app, token, "PATCH", `/api/v1/classify/${NON_EXISTENT_UUID}/override`, {
      category: "EXTREMISM",
      riskScore: 0.9,
      reason: "Manual override test",
    });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("NOT_FOUND");
  });
});
