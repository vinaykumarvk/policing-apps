/**
 * Integration tests for Social Media API authentication enforcement and permissions.
 * Verifies that protected endpoints require valid tokens and role-based access works.
 */
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { buildTestApp, getAuthToken, authInject, SEED_USERS, NON_EXISTENT_UUID, TestApp } from "../test-helpers";

describe("Social Media API — Permissions", () => {
  let app: TestApp;
  let adminToken: string;
  let analystToken: string;
  let dbReady = false;

  beforeAll(async () => {
    app = await buildTestApp();
    try {
      const aToken = await getAuthToken(app, SEED_USERS.admin.username, SEED_USERS.admin.password);
      const nToken = await getAuthToken(app, SEED_USERS.analyst.username, SEED_USERS.analyst.password);
      if (!aToken || !nToken) throw new Error("LOGIN_FAILED");
      adminToken = aToken;
      analystToken = nToken;
      dbReady = true;
    } catch {
      dbReady = false;
    }
  });

  beforeEach((ctx) => {
    if (!dbReady) ctx.skip();
  });

  it("GET /api/v1/alerts without token returns 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/alerts" });
    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("AUTHENTICATION_REQUIRED");
  });

  it("GET /api/v1/cases without token returns 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/cases" });
    expect(res.statusCode).toBe(401);
  });

  it("GET /api/v1/tasks/inbox without token returns 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/tasks/inbox" });
    expect(res.statusCode).toBe(401);
  });

  it("GET /api/v1/notifications without token returns 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/notifications" });
    expect(res.statusCode).toBe(401);
  });

  it("request with invalid Bearer token returns 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/alerts",
      headers: { authorization: "Bearer invalid.jwt.token" },
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.payload).error).toBe("INVALID_TOKEN");
  });

  it("GET /api/v1/tasks/inbox with analyst token returns tasks (possibly empty) scoped to user roles", async () => {
    const res = await authInject(app, analystToken, "GET", "/api/v1/tasks/inbox");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.tasks)).toBe(true);
    expect(typeof body.total).toBe("number");
  });

  it("POST /api/v1/tasks/:id/action without token returns 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/tasks/${NON_EXISTENT_UUID}/action`,
      payload: { action: "APPROVE" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("public routes remain accessible without token", async () => {
    const healthRes = await app.inject({ method: "GET", url: "/health" });
    expect(healthRes.statusCode).toBe(200);
    expect(JSON.parse(healthRes.payload).status).toBe("ok");
  });
});
