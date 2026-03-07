import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, getAuthToken, authInject, isDatabaseReady } from "../test-helpers";
import { FastifyInstance } from "fastify";

let app: FastifyInstance;
let token: string;
let dbReady = false;

const NON_EXISTENT_UUID = "00000000-0000-0000-0000-000000000000";

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

describe("Entity Ops — POST /api/v1/entities/merge", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/entities/merge",
      payload: {
        targetId: NON_EXISTENT_UUID,
        sourceId: NON_EXISTENT_UUID,
      },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("Entity Ops — GET /api/v1/entities/:id/timeline", () => {
  it.skipIf(!dbReady)("returns an array for a non-existent entity (404)", async () => {
    const res = await authInject(
      app,
      token,
      "GET",
      `/api/v1/entities/${NON_EXISTENT_UUID}/timeline`,
    );
    // Non-existent entity should return 404
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("ENTITY_NOT_FOUND");
  });
});

describe("Entity Ops — POST /api/v1/entities/split", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/entities/split",
      payload: {
        entityId: NON_EXISTENT_UUID,
        newEntities: [{ entityType: "PHONE", entityValue: "1234567890" }],
      },
    });
    expect(res.statusCode).toBe(401);
  });
});
