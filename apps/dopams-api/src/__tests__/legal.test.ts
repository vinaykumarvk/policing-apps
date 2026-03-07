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

describe("Legal Routes", () => {
  it("GET /api/v1/legal/sections without auth returns 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/legal/sections",
    });

    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady)("GET /api/v1/legal/sections returns statutes array", async () => {
    const res = await authInject(app, token, {
      method: "GET",
      url: "/api/v1/legal/sections",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("statutes");
    expect(Array.isArray(body.statutes)).toBe(true);
  });

  it.skipIf(!dbReady)("GET /api/v1/legal/sections supports search query", async () => {
    const res = await authInject(app, token, {
      method: "GET",
      url: "/api/v1/legal/sections?q=ndps",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("statutes");
    expect(Array.isArray(body.statutes)).toBe(true);
  });

  it.skipIf(!dbReady)("POST /api/v1/legal/suggest returns suggestions", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/legal/suggest",
      payload: { text: "possession of controlled substance" },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("suggestions");
    expect(Array.isArray(body.suggestions)).toBe(true);
  });

  it.skipIf(!dbReady)("POST /api/v1/legal/suggest with empty text returns empty suggestions", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/legal/suggest",
      payload: { text: "" },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("suggestions");
    expect(body.suggestions).toEqual([]);
  });

  it.skipIf(!dbReady)("POST /api/v1/legal/map with unknown entity type returns 400", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/legal/map",
      payload: {
        entityType: "unknown_type",
        entityId: "00000000-0000-0000-0000-000000000001",
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("error", "UNKNOWN_ENTITY_TYPE");
  });

  it.skipIf(!dbReady)("POST /api/v1/legal/map with non-existent entity returns 404", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/legal/map",
      payload: {
        entityType: "dopams_alert",
        entityId: "00000000-0000-0000-0000-000000000099",
      },
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("error", "NOT_FOUND");
  });

  it.skipIf(!dbReady)("GET /api/v1/legal/mappings/:entityType/:entityId returns mappings", async () => {
    const res = await authInject(app, token, {
      method: "GET",
      url: "/api/v1/legal/mappings/dopams_alert/00000000-0000-0000-0000-000000000001",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("mappings");
    expect(Array.isArray(body.mappings)).toBe(true);
  });

  it.skipIf(!dbReady)("PATCH /api/v1/legal/mappings/:mappingId/confirm returns 404 for non-existent mapping", async () => {
    const res = await authInject(app, token, {
      method: "PATCH",
      url: "/api/v1/legal/mappings/00000000-0000-0000-0000-000000000099/confirm",
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("error", "NOT_FOUND");
  });

  it.skipIf(!dbReady)("POST /api/v1/legal/mappings rejects missing required fields", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/legal/mappings",
      payload: { entityType: "dopams_alert" },
    });

    // Missing entityId and statuteId should return 400
    expect(res.statusCode).toBe(400);
  });
});
