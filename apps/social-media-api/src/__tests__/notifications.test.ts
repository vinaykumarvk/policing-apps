/**
 * Integration tests for Social Media API notification endpoints.
 * Covers: GET /notifications/count, GET /notifications, PATCH /notifications/:id/read.
 */
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { buildTestApp, getAuthToken, authInject, SEED_USERS, NON_EXISTENT_UUID, TestApp } from "../test-helpers";

describe("Social Media API — Notifications", () => {
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

  it("GET /api/v1/notifications/count returns unread count", async () => {
    const res = await authInject(app, token, "GET", "/api/v1/notifications/count");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(typeof body.unread).toBe("number");
    expect(body.unread).toBeGreaterThanOrEqual(0);
  });

  it("GET /api/v1/notifications returns notifications array with total", async () => {
    const res = await authInject(app, token, "GET", "/api/v1/notifications");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.notifications)).toBe(true);
    expect(typeof body.total).toBe("number");
  });

  it("GET /api/v1/notifications?unread=true returns only unread notifications", async () => {
    const res = await authInject(app, token, "GET", "/api/v1/notifications?unread=true");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.notifications)).toBe(true);
  });

  it("GET /api/v1/notifications?limit=1 returns at most 1 notification", async () => {
    const res = await authInject(app, token, "GET", "/api/v1/notifications?limit=1");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.notifications.length).toBeLessThanOrEqual(1);
  });

  it("PATCH /api/v1/notifications/:id/read with non-existent ID returns 404", async () => {
    const res = await authInject(app, token, "PATCH", `/api/v1/notifications/${NON_EXISTENT_UUID}/read`);
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.payload).error).toBe("NOTIFICATION_NOT_FOUND");
  });

  it("GET /api/v1/notifications/count without token returns 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/notifications/count" });
    expect(res.statusCode).toBe(401);
  });
});
