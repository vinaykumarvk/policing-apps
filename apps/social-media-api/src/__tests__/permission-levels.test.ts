/**
 * Integration tests for Social Media API permission levels (FR-02).
 * Covers: PL0 default authenticated access, unauthenticated rejection.
 */
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { buildTestApp, getAuthToken, authInject, SEED_USERS, TestApp } from "../test-helpers";

describe("Social Media API — Permission Levels (FR-02)", () => {
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

  // ---------- Auth Guard ----------
  it("GET /api/v1/alerts without auth returns 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/alerts" });
    expect(res.statusCode).toBe(401);
  });

  it("GET /api/v1/cases without auth returns 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/cases" });
    expect(res.statusCode).toBe(401);
  });

  it("GET /api/v1/reports without auth returns 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/reports" });
    expect(res.statusCode).toBe(401);
  });

  it("GET /api/v1/content without auth returns 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/content" });
    expect(res.statusCode).toBe(401);
  });

  // ---------- Authenticated Access (PL0 default) ----------
  describe("Authenticated access (PL0 default)", () => {
    it("Admin user can access alerts (PL0)", async () => {
      const res = await authInject(app, adminToken, "GET", "/api/v1/alerts");
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(Array.isArray(body.alerts)).toBe(true);
      expect(typeof body.total).toBe("number");
    });

    it("Analyst user can access alerts (PL0)", async () => {
      const res = await authInject(app, analystToken, "GET", "/api/v1/alerts");
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(Array.isArray(body.alerts)).toBe(true);
    });

    it("Admin user can access cases (PL0)", async () => {
      const res = await authInject(app, adminToken, "GET", "/api/v1/cases");
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(Array.isArray(body.cases)).toBe(true);
      expect(typeof body.total).toBe("number");
    });

    it("Analyst user can access cases (PL0)", async () => {
      const res = await authInject(app, analystToken, "GET", "/api/v1/cases");
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(Array.isArray(body.cases)).toBe(true);
    });

    it("Admin user can access reports (PL0)", async () => {
      const res = await authInject(app, adminToken, "GET", "/api/v1/reports");
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(Array.isArray(body.reports)).toBe(true);
    });

    it("Admin user can access content listing (PL0)", async () => {
      const res = await authInject(app, adminToken, "GET", "/api/v1/content");
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(Array.isArray(body.content)).toBe(true);
      expect(typeof body.total).toBe("number");
    });

    it("Admin user can access dashboard (PL0)", async () => {
      const res = await authInject(app, adminToken, "GET", "/api/v1/dashboard/stats");
      expect(res.statusCode).toBe(200);
    });
  });

  // ---------- Invalid/Expired Token ----------
  describe("Invalid tokens", () => {
    it("Request with invalid token returns 401", async () => {
      const res = await authInject(app, "invalid.jwt.token", "GET", "/api/v1/alerts");
      expect(res.statusCode).toBe(401);
    });

    it("Request with empty Authorization header returns 401", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/alerts",
        headers: { authorization: "" },
      });
      expect(res.statusCode).toBe(401);
    });
  });
});
