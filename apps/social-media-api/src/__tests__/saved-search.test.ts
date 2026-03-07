/**
 * Integration tests for Social Media API saved search routes.
 * Covers: list, create, and unauthenticated access.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, getAuthToken, authInject, isDatabaseReady } from "../test-helpers";
import { FastifyInstance } from "fastify";

describe("Social Media API — Saved Searches", () => {
  let app: FastifyInstance;
  let token: string;
  let dbReady = false;

  beforeAll(async () => {
    app = await buildTestApp();
    dbReady = await isDatabaseReady(app);
    if (dbReady) {
      token = await getAuthToken(app);
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/v1/saved-searches without auth returns 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/saved-searches" });
    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady)("GET /api/v1/saved-searches returns array with total", async () => {
    const res = await authInject(app, token, "GET", "/api/v1/saved-searches");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.savedSearches)).toBe(true);
    expect(typeof body.total).toBe("number");
  });

  it.skipIf(!dbReady)("POST /api/v1/saved-searches creates a saved search", async () => {
    const res = await authInject(app, token, "POST", "/api/v1/saved-searches", {
      searchName: "Integration Test Search",
      queryJsonb: { platform: "twitter", keywords: ["test"] },
      alertOnMatch: false,
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.savedSearch).toBeDefined();
    expect(body.savedSearch.search_name).toBe("Integration Test Search");
    expect(body.savedSearch.alert_on_match).toBe(false);
    expect(body.savedSearch.search_id).toBeDefined();
  });
});
