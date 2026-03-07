/**
 * Integration tests for Social Media API drug classification routes.
 * Covers: POST classify, GET classification, PATCH review, distribution, recidivists.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, getAuthToken, authInject, isDatabaseReady, SEED_USERS, NON_EXISTENT_UUID } from "../test-helpers";
import { FastifyInstance } from "fastify";

describe("Social Media API — Drug Classify", () => {
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

  it("POST /api/v1/drug-classify/sm_alert/:id without auth returns 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/drug-classify/sm_alert/${NON_EXISTENT_UUID}`,
    });
    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady)("POST /api/v1/drug-classify with unknown entity type returns 400", async () => {
    const res = await authInject(app, token, "POST", `/api/v1/drug-classify/invalid_type/${NON_EXISTENT_UUID}`);
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("UNKNOWN_ENTITY_TYPE");
  });

  it.skipIf(!dbReady)("POST /api/v1/drug-classify/sm_alert/:id with non-existent entity returns 404", async () => {
    const res = await authInject(app, token, "POST", `/api/v1/drug-classify/sm_alert/${NON_EXISTENT_UUID}`);
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("NOT_FOUND");
  });

  it.skipIf(!dbReady)("GET /api/v1/drug-classify/sm_alert/:id returns classifications array", async () => {
    const res = await authInject(app, token, "GET", `/api/v1/drug-classify/sm_alert/${NON_EXISTENT_UUID}`);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.classifications)).toBe(true);
  });

  it.skipIf(!dbReady)("PATCH /api/v1/drug-classify/:id/review with non-existent ID returns 404", async () => {
    const res = await authInject(app, token, "PATCH", `/api/v1/drug-classify/${NON_EXISTENT_UUID}/review`, {
      reviewStatus: "CONFIRMED",
    });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("NOT_FOUND");
  });

  it.skipIf(!dbReady)("GET /api/v1/drug-classify/distribution returns distribution data", async () => {
    const res = await authInject(app, token, "GET", "/api/v1/drug-classify/distribution");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.distribution).toBeDefined();
  });

  it.skipIf(!dbReady)("GET /api/v1/drug-classify/recidivists returns recidivists data", async () => {
    const res = await authInject(app, token, "GET", "/api/v1/drug-classify/recidivists");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.recidivists).toBeDefined();
  });
});
