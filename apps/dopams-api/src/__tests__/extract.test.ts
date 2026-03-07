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

describe("Extract Routes", () => {
  it("POST /api/v1/extract/dopams_alert/:entityId without auth returns 401", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/extract/dopams_alert/${fakeId}`,
    });

    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady)("POST /api/v1/extract/:entityType/:entityId returns 404 for missing entity", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await authInject(app, token, {
      method: "POST",
      url: `/api/v1/extract/dopams_alert/${fakeId}`,
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("ENTITY_NOT_FOUND");
  });

  it.skipIf(!dbReady)("POST /api/v1/extract/:entityType/:entityId returns 400 for unknown entity type", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await authInject(app, token, {
      method: "POST",
      url: `/api/v1/extract/unknown_type/${fakeId}`,
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("UNKNOWN_ENTITY_TYPE");
  });

  it.skipIf(!dbReady)("GET /api/v1/extract/:entityType/:entityId returns entities array", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await authInject(app, token, {
      method: "GET",
      url: `/api/v1/extract/dopams_alert/${fakeId}`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("entities");
    expect(Array.isArray(body.entities)).toBe(true);
  });

  it.skipIf(!dbReady)("GET /api/v1/graph/:entityId returns graph data", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await authInject(app, token, {
      method: "GET",
      url: `/api/v1/graph/${fakeId}`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    // Graph endpoint returns nodes/edges structure
    expect(body).toBeDefined();
  });
});
