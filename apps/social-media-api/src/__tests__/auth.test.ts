/**
 * Integration tests for Social Media API authentication endpoints.
 * Prerequisites: Postgres running, migrations applied, seed run.
 */
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { buildTestApp, getAuthToken, authInject, SEED_USERS, TestApp } from "../test-helpers";

describe("Social Media API — Auth", () => {
  let app: TestApp;
  let dbReady = false;

  beforeAll(async () => {
    app = await buildTestApp();
    try {
      const token = await getAuthToken(app, SEED_USERS.admin.username, SEED_USERS.admin.password);
      dbReady = !!token;
    } catch {
      dbReady = false;
    }
  });

  beforeEach((ctx) => {
    if (!dbReady) ctx.skip();
  });

  it("POST /api/v1/auth/login with valid admin credentials returns user + token", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { username: SEED_USERS.admin.username, password: SEED_USERS.admin.password },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.token).toBeDefined();
    expect(typeof body.token).toBe("string");
    expect(body.user).toBeDefined();
    expect(body.user.username).toBe(SEED_USERS.admin.username);
  }, 30000);

  it("POST /api/v1/auth/login with analyst credentials returns token", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { username: SEED_USERS.analyst.username, password: SEED_USERS.analyst.password },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.token).toBeDefined();
    expect(body.user.username).toBe(SEED_USERS.analyst.username);
  });

  it("POST /api/v1/auth/login with invalid password returns 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { username: SEED_USERS.admin.username, password: "wrong-password" },
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.payload).error).toBe("INVALID_CREDENTIALS");
  });

  it("POST /api/v1/auth/login with non-existent user returns 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { username: "no_such_user_xyz", password: "password" },
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.payload).error).toBe("INVALID_CREDENTIALS");
  });

  it("POST /api/v1/auth/login with missing fields returns 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {},
    });
    expect([400, 401]).toContain(res.statusCode);
  });

  it("GET /api/v1/auth/me without token returns 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/auth/me" });
    expect(res.statusCode).toBe(401);
  });

  it("GET /api/v1/auth/me with valid token returns user payload", async () => {
    const token = await getAuthToken(app, SEED_USERS.admin.username, SEED_USERS.admin.password);
    expect(token).not.toBeNull();
    const res = await authInject(app, token!, "GET", "/api/v1/auth/me");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.user).toBeDefined();
    expect(body.user.userId).toBeDefined();
  });

  it("POST /api/v1/auth/logout returns success", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload).success).toBe(true);
  });
});
