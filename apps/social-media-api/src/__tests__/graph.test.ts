/**
 * Integration tests for Social Media API graph analysis routes.
 * Covers: POST analyze, GET node analysis, GET kingpins.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, getAuthToken, authInject, isDatabaseReady, SEED_USERS, NON_EXISTENT_UUID } from "../test-helpers";
import { FastifyInstance } from "fastify";

describe("Social Media API — Graph Analysis", () => {
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

  it("POST /api/v1/graph/analyze without auth returns 401", async () => {
    const res = await app.inject({ method: "POST", url: "/api/v1/graph/analyze" });
    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady)("POST /api/v1/graph/analyze runs network analysis", async () => {
    const res = await authInject(app, token, "POST", "/api/v1/graph/analyze");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    // Expect analysis result object
    expect(body).toBeDefined();
  });

  it.skipIf(!dbReady)("GET /api/v1/graph/node/:entityId with non-existent entity returns 404", async () => {
    const res = await authInject(app, token, "GET", `/api/v1/graph/node/${NON_EXISTENT_UUID}`);
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("NOT_FOUND");
  });

  it.skipIf(!dbReady)("GET /api/v1/graph/kingpins returns kingpins array", async () => {
    const res = await authInject(app, token, "GET", "/api/v1/graph/kingpins");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.kingpins)).toBe(true);
  });
});
