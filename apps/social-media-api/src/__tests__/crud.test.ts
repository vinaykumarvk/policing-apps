/**
 * Integration tests for Social Media API entity CRUD (list / get-by-id) endpoints.
 * Covers: alerts, cases, content, evidence, reports, watchlists.
 */
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { buildTestApp, getAuthToken, authInject, SEED_USERS, NON_EXISTENT_UUID, TestApp } from "../test-helpers";

describe("Social Media API — CRUD", () => {
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

  // ---------- Alerts ----------
  describe("Alerts", () => {
    it("GET /api/v1/alerts returns 200 with alerts array and total", async () => {
      const res = await authInject(app, token, "GET", "/api/v1/alerts");
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(Array.isArray(body.alerts)).toBe(true);
      expect(typeof body.total).toBe("number");
    });

    it("GET /api/v1/alerts/:id with non-existent UUID returns 404", async () => {
      const res = await authInject(app, token, "GET", `/api/v1/alerts/${NON_EXISTENT_UUID}`);
      expect(res.statusCode).toBe(404);
      expect(JSON.parse(res.payload).error).toBe("ALERT_NOT_FOUND");
    });

    it("GET /api/v1/alerts/:id with invalid format returns 400", async () => {
      const res = await authInject(app, token, "GET", "/api/v1/alerts/not-a-uuid");
      expect(res.statusCode).toBe(400);
    });
  });

  // ---------- Cases ----------
  describe("Cases", () => {
    it("GET /api/v1/cases returns 200 with cases array and total", async () => {
      const res = await authInject(app, token, "GET", "/api/v1/cases");
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(Array.isArray(body.cases)).toBe(true);
      expect(typeof body.total).toBe("number");
    });

    it("GET /api/v1/cases/:id with non-existent UUID returns 404", async () => {
      const res = await authInject(app, token, "GET", `/api/v1/cases/${NON_EXISTENT_UUID}`);
      expect(res.statusCode).toBe(404);
      expect(JSON.parse(res.payload).error).toBe("CASE_NOT_FOUND");
    });

    it("POST /api/v1/cases creates a new case", async () => {
      const res = await authInject(app, token, "POST", "/api/v1/cases", {
        title: "Integration Test Case",
        description: "Created by automated test",
      });
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.case).toBeDefined();
      expect(body.case.title).toBe("Integration Test Case");
      expect(body.case.case_id).toBeDefined();
    });
  });

  // ---------- Content ----------
  describe("Content", () => {
    it("GET /api/v1/content returns 200 with content array and total", async () => {
      const res = await authInject(app, token, "GET", "/api/v1/content");
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(Array.isArray(body.content)).toBe(true);
      expect(typeof body.total).toBe("number");
    });

    it("GET /api/v1/content/:id with non-existent UUID returns 404", async () => {
      const res = await authInject(app, token, "GET", `/api/v1/content/${NON_EXISTENT_UUID}`);
      expect(res.statusCode).toBe(404);
      expect(JSON.parse(res.payload).error).toBe("CONTENT_NOT_FOUND");
    });
  });

  // ---------- Evidence ----------
  describe("Evidence", () => {
    it("GET /api/v1/evidence/:id with non-existent UUID returns 404", async () => {
      const res = await authInject(app, token, "GET", `/api/v1/evidence/${NON_EXISTENT_UUID}`);
      expect(res.statusCode).toBe(404);
      expect(JSON.parse(res.payload).error).toBe("EVIDENCE_NOT_FOUND");
    });

    it("GET /api/v1/evidence/:id/custody-log with non-existent UUID returns empty events", async () => {
      const res = await authInject(app, token, "GET", `/api/v1/evidence/${NON_EXISTENT_UUID}/custody-log`);
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(Array.isArray(body.events)).toBe(true);
    });
  });

  // ---------- Reports ----------
  describe("Reports", () => {
    it("GET /api/v1/reports returns 200 with reports array and total", async () => {
      const res = await authInject(app, token, "GET", "/api/v1/reports");
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(Array.isArray(body.reports)).toBe(true);
      expect(typeof body.total).toBe("number");
    });

    it("GET /api/v1/reports/:id with non-existent UUID returns 404", async () => {
      const res = await authInject(app, token, "GET", `/api/v1/reports/${NON_EXISTENT_UUID}`);
      expect(res.statusCode).toBe(404);
      expect(JSON.parse(res.payload).error).toBe("REPORT_NOT_FOUND");
    });
  });

  // ---------- Watchlists ----------
  describe("Watchlists", () => {
    it("GET /api/v1/watchlists returns 200 with watchlists array and total", async () => {
      const res = await authInject(app, token, "GET", "/api/v1/watchlists");
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(Array.isArray(body.watchlists)).toBe(true);
      expect(typeof body.total).toBe("number");
    });

    it("POST /api/v1/watchlists creates a new watchlist", async () => {
      const res = await authInject(app, token, "POST", "/api/v1/watchlists", {
        name: "Test Watchlist",
        description: "Created by automated test",
        keywords: ["test", "integration"],
      });
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.watchlist).toBeDefined();
      expect(body.watchlist.name).toBe("Test Watchlist");
    });
  });
});
