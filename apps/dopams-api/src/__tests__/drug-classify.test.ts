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

describe("Drug Classify Routes", () => {
  it("POST /api/v1/drug-classify/:entityType/:entityId without auth returns 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/drug-classify/dopams_alert/00000000-0000-0000-0000-000000000001",
    });

    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady)("POST /api/v1/drug-classify with unknown entity type returns 400", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/drug-classify/unknown_type/00000000-0000-0000-0000-000000000001",
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("error", "UNKNOWN_ENTITY_TYPE");
  });

  it.skipIf(!dbReady)("POST /api/v1/drug-classify with non-existent entity returns 404", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/drug-classify/dopams_alert/00000000-0000-0000-0000-000000000099",
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("error", "NOT_FOUND");
  });

  it.skipIf(!dbReady)("GET /api/v1/drug-classify/:entityType/:entityId returns classifications", async () => {
    const res = await authInject(app, token, {
      method: "GET",
      url: "/api/v1/drug-classify/dopams_alert/00000000-0000-0000-0000-000000000001",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("classifications");
    expect(Array.isArray(body.classifications)).toBe(true);
  });

  it.skipIf(!dbReady)("PATCH /api/v1/drug-classify/:classificationId/review rejects invalid status", async () => {
    const res = await authInject(app, token, {
      method: "PATCH",
      url: "/api/v1/drug-classify/00000000-0000-0000-0000-000000000001/review",
      payload: { reviewStatus: "INVALID_STATUS" },
    });

    expect(res.statusCode).toBe(400);
  });

  it.skipIf(!dbReady)("PATCH /api/v1/drug-classify/:classificationId/review returns 404 for non-existent classification", async () => {
    const res = await authInject(app, token, {
      method: "PATCH",
      url: "/api/v1/drug-classify/00000000-0000-0000-0000-000000000099/review",
      payload: { reviewStatus: "CONFIRMED" },
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("error", "NOT_FOUND");
  });

  it.skipIf(!dbReady)("GET /api/v1/drug-classify/distribution returns distribution data", async () => {
    const res = await authInject(app, token, {
      method: "GET",
      url: "/api/v1/drug-classify/distribution",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("distribution");
  });

  it.skipIf(!dbReady)("GET /api/v1/drug-classify/recidivists returns recidivists data", async () => {
    const res = await authInject(app, token, {
      method: "GET",
      url: "/api/v1/drug-classify/recidivists",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("recidivists");
  });
});
