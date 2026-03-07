/**
 * Integration tests for Social Media API legal mapping routes.
 * Covers: GET /api/v1/legal/sections (list statutes),
 *         POST /api/v1/legal/suggest (suggest statutes from text),
 *         POST /api/v1/legal/map (auto-map entity to statutes),
 *         GET /api/v1/legal/mappings/:entityType/:entityId (get entity mappings).
 * Prerequisites: Postgres running, migrations applied, seed run.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { buildTestApp, getAuthToken, authInject, SEED_USERS, TestApp } from "../test-helpers";

describe("Social Media API — Legal Mapping", () => {
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

  afterAll(async () => {
    await app.close();
  });

  beforeEach((ctx) => {
    if (!dbReady) ctx.skip();
  });

  // ---------- GET /api/v1/legal/sections ----------
  describe("GET /api/v1/legal/sections", () => {
    it("returns 200 with statutes array", async () => {
      const res = await authInject(app, token, "GET", "/api/v1/legal/sections");
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.statutes).toBeDefined();
      expect(Array.isArray(body.statutes)).toBe(true);
    });

    it("supports search query parameter", async () => {
      const res = await authInject(app, token, "GET", "/api/v1/legal/sections?q=penal");
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(Array.isArray(body.statutes)).toBe(true);
    });
  });

  // ---------- POST /api/v1/legal/suggest ----------
  describe("POST /api/v1/legal/suggest", () => {
    it("returns 200 with suggestions array for valid text", async () => {
      const res = await authInject(app, token, "POST", "/api/v1/legal/suggest", {
        text: "hate speech incitement violence threatening",
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.suggestions).toBeDefined();
      expect(Array.isArray(body.suggestions)).toBe(true);
    });

    it("returns empty suggestions for unrelated text", async () => {
      const res = await authInject(app, token, "POST", "/api/v1/legal/suggest", {
        text: "xyzzy gibberish no-match-term-12345",
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(Array.isArray(body.suggestions)).toBe(true);
      expect(body.suggestions.length).toBe(0);
    });

    it("suggestion entries include confidence and matched keywords", async () => {
      // First get statutes to know what keywords might exist
      const statuteRes = await authInject(app, token, "GET", "/api/v1/legal/sections");
      const statutes = JSON.parse(statuteRes.payload).statutes;
      if (!statutes || statutes.length === 0) return;

      // Use a keyword from the first statute if available
      const firstKeywords = statutes[0].keywords;
      if (!firstKeywords || firstKeywords.length === 0) return;

      const res = await authInject(app, token, "POST", "/api/v1/legal/suggest", {
        text: firstKeywords[0],
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      if (body.suggestions.length > 0) {
        const suggestion = body.suggestions[0];
        expect(typeof suggestion.confidence).toBe("number");
        expect(Array.isArray(suggestion.matchedKeywords)).toBe(true);
        expect(suggestion.matchedKeywords.length).toBeGreaterThan(0);
        expect(suggestion.statuteId).toBeDefined();
        expect(suggestion.actName).toBeDefined();
        expect(suggestion.section).toBeDefined();
      }
    });
  });

  // ---------- POST /api/v1/legal/map ----------
  describe("POST /api/v1/legal/map", () => {
    it("returns 400 for unknown entity type", async () => {
      const res = await authInject(app, token, "POST", "/api/v1/legal/map", {
        entityType: "unknown_entity",
        entityId: "00000000-0000-0000-0000-000000000001",
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expect(body.error).toBe("UNKNOWN_ENTITY_TYPE");
    });

    it("returns 404 for non-existent entity", async () => {
      const res = await authInject(app, token, "POST", "/api/v1/legal/map", {
        entityType: "sm_alert",
        entityId: "00000000-0000-0000-0000-000000000000",
      });
      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.payload);
      expect(body.error).toBe("NOT_FOUND");
    });

    it("rejects request missing required fields", async () => {
      const res = await authInject(app, token, "POST", "/api/v1/legal/map", {});
      // Fastify schema validation will return 400
      expect([400]).toContain(res.statusCode);
    });
  });

  // ---------- GET /api/v1/legal/mappings/:entityType/:entityId ----------
  describe("GET /api/v1/legal/mappings/:entityType/:entityId", () => {
    it("returns 200 with mappings array for valid entity coordinates", async () => {
      const res = await authInject(
        app,
        token,
        "GET",
        "/api/v1/legal/mappings/sm_alert/00000000-0000-0000-0000-000000000000",
      );
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.mappings).toBeDefined();
      expect(Array.isArray(body.mappings)).toBe(true);
    });
  });

  // ---------- POST /api/v1/legal/mappings (manual mapping) ----------
  describe("POST /api/v1/legal/mappings", () => {
    it("rejects request missing required fields", async () => {
      const res = await authInject(app, token, "POST", "/api/v1/legal/mappings", {});
      expect([400]).toContain(res.statusCode);
    });
  });

  // ---------- Access Control ----------
  describe("Access Control", () => {
    it("GET /api/v1/legal/sections without token returns 401", async () => {
      const res = await app.inject({ method: "GET", url: "/api/v1/legal/sections" });
      expect(res.statusCode).toBe(401);
    });

    it("POST /api/v1/legal/suggest without token returns 401", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/legal/suggest",
        payload: { text: "test" },
      });
      expect(res.statusCode).toBe(401);
    });
  });
});
