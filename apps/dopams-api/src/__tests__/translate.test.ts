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

describe("Translate Routes", () => {
  it("POST /api/v1/translate without auth returns 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/translate",
      payload: {
        entityType: "dopams_alert",
        entityId: "00000000-0000-0000-0000-000000000000",
        targetLanguage: "hi",
      },
    });

    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady)("POST /api/v1/translate returns 400 for unknown entity type", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/translate",
      payload: {
        entityType: "unknown_type",
        entityId: fakeId,
        targetLanguage: "hi",
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("UNKNOWN_ENTITY_TYPE");
  });

  it.skipIf(!dbReady)("POST /api/v1/translate returns 404 for missing entity", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/translate",
      payload: {
        entityType: "dopams_alert",
        entityId: fakeId,
        targetLanguage: "hi",
      },
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("NOT_FOUND");
  });

  it.skipIf(!dbReady)("GET /api/v1/translations/:entityType/:entityId returns translations array", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await authInject(app, token, {
      method: "GET",
      url: `/api/v1/translations/dopams_alert/${fakeId}`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("translations");
    expect(Array.isArray(body.translations)).toBe(true);
  });
});
