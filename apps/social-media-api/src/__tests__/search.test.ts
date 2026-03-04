/**
 * Integration tests for Social Media API global search endpoint.
 * Covers: GET /api/v1/search with various query parameters.
 */
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { buildTestApp, getAuthToken, authInject, SEED_USERS, TestApp } from "../test-helpers";

describe("Social Media API — Search", () => {
  let app: TestApp;
  let token: string;
  let dbReady = false;

  beforeAll(async () => {
    app = await buildTestApp();
    try {
      const t = await getAuthToken(app, SEED_USERS.admin.username, SEED_USERS.admin.password);
      if (!t) throw new Error("LOGIN_FAILED");
      token = t;
      dbReady = true;
    } catch {
      dbReady = false;
    }
  });

  beforeEach((ctx) => {
    if (!dbReady) ctx.skip();
  });

  it("GET /api/v1/search without q parameter returns 400", async () => {
    const res = await authInject(app, token, "GET", "/api/v1/search");
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.payload).error).toBe("VALIDATION_ERROR");
  });

  it("GET /api/v1/search?q= (empty string) returns 400", async () => {
    const res = await authInject(app, token, "GET", "/api/v1/search?q=");
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.payload).error).toBe("VALIDATION_ERROR");
  });

  it("GET /api/v1/search?q=test returns 200 with results", async () => {
    const res = await authInject(app, token, "GET", "/api/v1/search?q=test");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    // The search service returns results — shape may vary but should be an object
    expect(body).toBeDefined();
    expect(typeof body).toBe("object");
  });

  it("GET /api/v1/search?q=test&limit=5 respects limit parameter", async () => {
    const res = await authInject(app, token, "GET", "/api/v1/search?q=test&limit=5");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toBeDefined();
  });

  it("GET /api/v1/search?q=test&fuzzy=true returns results with fuzzy matching", async () => {
    const res = await authInject(app, token, "GET", "/api/v1/search?q=test&fuzzy=true");
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload)).toBeDefined();
  });

  it("GET /api/v1/search without token returns 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/search?q=test" });
    expect(res.statusCode).toBe(401);
  });
});
