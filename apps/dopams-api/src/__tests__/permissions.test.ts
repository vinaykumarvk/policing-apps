import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FastifyInstance } from "fastify";
import { buildTestApp, isDatabaseReady } from "../test-helpers";

let app: FastifyInstance;
let dbReady = false;

beforeAll(async () => {
  app = await buildTestApp();
  dbReady = await isDatabaseReady(app);
});

afterAll(async () => {
  await app.close();
});

describe("Authentication enforcement", () => {
  it("GET /api/v1/alerts returns 401 without token", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/alerts" });
    expect(res.statusCode).toBe(401);
  });

  it("GET /api/v1/leads returns 401 without token", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/leads" });
    expect(res.statusCode).toBe(401);
  });

  it("GET /api/v1/cases returns 401 without token", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/cases" });
    expect(res.statusCode).toBe(401);
  });

  it("GET /api/v1/subjects returns 401 without token", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/subjects" });
    expect(res.statusCode).toBe(401);
  });

  it("GET /api/v1/tasks/inbox returns 401 without token", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/tasks/inbox" });
    expect(res.statusCode).toBe(401);
  });

  it("GET /api/v1/notifications returns 401 without token", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/notifications" });
    expect(res.statusCode).toBe(401);
  });

  it("returns 401 with an invalid Bearer token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/alerts",
      headers: { authorization: "Bearer invalid.token.value" },
    });
    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("INVALID_TOKEN");
  });

  it("public routes do not require auth", async () => {
    const health = await app.inject({ method: "GET", url: "/health" });
    expect(health.statusCode).toBe(200);

    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { username: "fake", password: "fake" },
    });
    // Should get 401 (invalid creds) or 500 (no DB) — not a middleware 403 rejection
    expect([200, 401, 500]).toContain(login.statusCode);
  });
});
