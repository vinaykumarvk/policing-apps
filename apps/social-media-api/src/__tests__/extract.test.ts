/**
 * Integration tests for Social Media API entity extraction routes.
 * Covers: POST extract, GET extracted entities, GET entity graph.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, getAuthToken, authInject, isDatabaseReady, SEED_USERS, NON_EXISTENT_UUID } from "../test-helpers";
import { FastifyInstance } from "fastify";

describe("Social Media API — Extract", () => {
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

  it("POST /api/v1/extract/sm_alert/:id without auth returns 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/extract/sm_alert/${NON_EXISTENT_UUID}`,
    });
    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady)("POST /api/v1/extract with unknown entity type returns 400", async () => {
    const res = await authInject(app, token, "POST", `/api/v1/extract/unknown_type/${NON_EXISTENT_UUID}`);
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("UNKNOWN_ENTITY_TYPE");
  });

  it.skipIf(!dbReady)("POST /api/v1/extract/sm_alert/:id with non-existent entity returns 404", async () => {
    const res = await authInject(app, token, "POST", `/api/v1/extract/sm_alert/${NON_EXISTENT_UUID}`);
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("ENTITY_NOT_FOUND");
  });

  it.skipIf(!dbReady)("GET /api/v1/extract/sm_alert/:id returns entities array", async () => {
    const res = await authInject(app, token, "GET", `/api/v1/extract/sm_alert/${NON_EXISTENT_UUID}`);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.entities)).toBe(true);
  });

  it.skipIf(!dbReady)("GET /api/v1/graph/:entityId returns graph structure", async () => {
    const res = await authInject(app, token, "GET", `/api/v1/graph/${NON_EXISTENT_UUID}`);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    // Graph should return nodes/edges or similar structure
    expect(body).toBeDefined();
  });
});
