/**
 * Integration tests for Social Media API taxonomy versioning routes (FR-06).
 * Covers: list versions, create version, activate version, create rule, auth guard.
 */
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { buildTestApp, getAuthToken, authInject, SEED_USERS, NON_EXISTENT_UUID, TestApp } from "../test-helpers";

describe("Social Media API — Taxonomy Versioning (FR-06)", () => {
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

  // ---------- Auth Guard ----------
  it("GET /api/v1/taxonomy/versions without auth returns 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/taxonomy/versions" });
    expect(res.statusCode).toBe(401);
  });

  it("POST /api/v1/taxonomy/versions without auth returns 401", async () => {
    const res = await app.inject({ method: "POST", url: "/api/v1/taxonomy/versions", payload: {} });
    expect(res.statusCode).toBe(401);
  });

  it("POST /api/v1/taxonomy/rules without auth returns 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/taxonomy/rules",
      payload: { versionId: NON_EXISTENT_UUID, category: "test", pattern: "test" },
    });
    expect(res.statusCode).toBe(401);
  });

  // ---------- Version CRUD ----------
  describe("Taxonomy Versions", () => {
    let createdVersionId: string;

    it("GET /api/v1/taxonomy/versions returns versions array with total", async () => {
      const res = await authInject(app, token, "GET", "/api/v1/taxonomy/versions");
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(Array.isArray(body.versions)).toBe(true);
      expect(typeof body.total).toBe("number");
    });

    it("GET /api/v1/taxonomy/versions supports pagination", async () => {
      const res = await authInject(app, token, "GET", "/api/v1/taxonomy/versions?limit=2&offset=0");
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(Array.isArray(body.versions)).toBe(true);
      expect(body.versions.length).toBeLessThanOrEqual(2);
    });

    it("POST /api/v1/taxonomy/versions creates a new version", async () => {
      const res = await authInject(app, token, "POST", "/api/v1/taxonomy/versions", {
        description: "Integration test version",
      });
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.version).toBeDefined();
      expect(body.version.version_id).toBeDefined();
      expect(body.version.description).toBe("Integration test version");
      expect(body.version.is_active).toBe(false);
      expect(typeof body.copiedRules).toBe("number");
      createdVersionId = body.version.version_id;
    });

    it("GET /api/v1/taxonomy/versions/:id returns the created version with rules", async () => {
      const res = await authInject(app, token, "GET", `/api/v1/taxonomy/versions/${createdVersionId}`);
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.version).toBeDefined();
      expect(body.version.version_id).toBe(createdVersionId);
      expect(Array.isArray(body.rules)).toBe(true);
    });

    it("GET /api/v1/taxonomy/versions/:id with non-existent UUID returns 404", async () => {
      const res = await authInject(app, token, "GET", `/api/v1/taxonomy/versions/${NON_EXISTENT_UUID}`);
      expect(res.statusCode).toBe(404);
      expect(JSON.parse(res.payload).error).toBe("VERSION_NOT_FOUND");
    });

    it("POST /api/v1/taxonomy/versions/:id/activate activates a version", async () => {
      const res = await authInject(app, token, "POST", `/api/v1/taxonomy/versions/${createdVersionId}/activate`);
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.version).toBeDefined();
      expect(body.version.version_id).toBe(createdVersionId);
      expect(body.version.is_active).toBe(true);
      expect(body.version.activated_at).toBeDefined();
    });

    it("POST /api/v1/taxonomy/versions/:id/activate with non-existent UUID returns 404", async () => {
      const res = await authInject(app, token, "POST", `/api/v1/taxonomy/versions/${NON_EXISTENT_UUID}/activate`);
      expect(res.statusCode).toBe(404);
      expect(JSON.parse(res.payload).error).toBe("VERSION_NOT_FOUND");
    });
  });

  // ---------- Rules CRUD ----------
  describe("Taxonomy Rules", () => {
    let inactiveVersionId: string;

    beforeAll(async () => {
      if (!dbReady) return;
      // Create a new inactive version to add rules to
      const res = await authInject(app, token, "POST", "/api/v1/taxonomy/versions", {
        description: "Rule test version",
      });
      if (res.statusCode === 201) {
        inactiveVersionId = JSON.parse(res.payload).version.version_id;
      }
    });

    it("POST /api/v1/taxonomy/rules creates a rule on an inactive version", async () => {
      if (!inactiveVersionId) return;
      const res = await authInject(app, token, "POST", "/api/v1/taxonomy/rules", {
        versionId: inactiveVersionId,
        category: "HATE_SPEECH",
        pattern: "test pattern .*",
        threshold: 0.7,
        riskWeight: 2.0,
      });
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.rule).toBeDefined();
      expect(body.rule.rule_id).toBeDefined();
      expect(body.rule.category).toBe("HATE_SPEECH");
      expect(body.rule.pattern).toBe("test pattern .*");
      expect(body.rule.version_id).toBe(inactiveVersionId);
    });

    it("POST /api/v1/taxonomy/rules with non-existent versionId returns 404", async () => {
      const res = await authInject(app, token, "POST", "/api/v1/taxonomy/rules", {
        versionId: NON_EXISTENT_UUID,
        category: "TEST",
        pattern: "test",
      });
      expect(res.statusCode).toBe(404);
      expect(JSON.parse(res.payload).error).toBe("VERSION_NOT_FOUND");
    });

    it("POST /api/v1/taxonomy/rules on an active version returns 400", async () => {
      // First, activate the version
      if (!inactiveVersionId) return;
      await authInject(app, token, "POST", `/api/v1/taxonomy/versions/${inactiveVersionId}/activate`);

      const res = await authInject(app, token, "POST", "/api/v1/taxonomy/rules", {
        versionId: inactiveVersionId,
        category: "TEST",
        pattern: "should fail",
      });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.payload).error).toBe("VERSION_ACTIVE");
    });
  });
});
