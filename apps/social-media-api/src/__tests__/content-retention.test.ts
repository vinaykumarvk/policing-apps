/**
 * Integration tests for Social Media API content retention and legal basis (FR-03).
 * Covers: content ingest with legalBasis, retention-flagged listing, auth guard.
 */
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { buildTestApp, getAuthToken, authInject, SEED_USERS, TestApp } from "../test-helpers";

describe("Social Media API — Content Retention & Legal Basis (FR-03)", () => {
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
  it("POST /api/v1/content/ingest without auth returns 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/content/ingest",
      payload: { platform: "Twitter", contentText: "test", legalBasis: "INVESTIGATION" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("GET /api/v1/connectors/retention-flagged without auth returns 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/connectors/retention-flagged" });
    expect(res.statusCode).toBe(401);
  });

  // ---------- Content Ingest with Legal Basis ----------
  describe("Content Ingest (FR-03)", () => {
    it("POST /api/v1/content/ingest requires legalBasis field", async () => {
      const res = await authInject(app, adminToken, "POST", "/api/v1/content/ingest", {
        platform: "Twitter",
        contentText: "Test content without legal basis",
        // legalBasis intentionally omitted
      });
      expect(res.statusCode).toBe(400);
    });

    it("POST /api/v1/content/ingest with invalid legalBasis returns 400", async () => {
      const res = await authInject(app, adminToken, "POST", "/api/v1/content/ingest", {
        platform: "Twitter",
        contentText: "Test content",
        legalBasis: "INVALID_BASIS",
      });
      expect(res.statusCode).toBe(400);
    });

    it("POST /api/v1/content/ingest with valid legalBasis creates content with retention", async () => {
      const res = await authInject(app, adminToken, "POST", "/api/v1/content/ingest", {
        platform: "Twitter",
        contentText: "Integration test content for retention",
        legalBasis: "INVESTIGATION",
        authorHandle: "@test_user",
        retentionDays: 90,
      });
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.content).toBeDefined();
      expect(body.content.content_id).toBeDefined();
      expect(body.content.platform).toBe("Twitter");
      expect(body.content.legal_basis).toBe("INVESTIGATION");
      expect(body.content.retention_until).toBeDefined();
      expect(body.content.ingested_at).toBeDefined();
    });

    it("POST /api/v1/content/ingest accepts all valid legalBasis enum values", async () => {
      const validBases = ["COURT_ORDER", "PUBLIC_INTEREST", "REGULATORY", "CONSENT", "NATIONAL_SECURITY"];
      for (const basis of validBases) {
        const res = await authInject(app, adminToken, "POST", "/api/v1/content/ingest", {
          platform: "Facebook",
          contentText: `Content with ${basis} basis`,
          legalBasis: basis,
        });
        expect(res.statusCode).toBe(201);
        const body = JSON.parse(res.payload);
        expect(body.content.legal_basis).toBe(basis);
      }
    });
  });

  // ---------- Retention-Flagged Content ----------
  describe("Retention Flagged (FR-03)", () => {
    it("GET /api/v1/connectors/retention-flagged with admin token returns content and total", async () => {
      const res = await authInject(app, adminToken, "GET", "/api/v1/connectors/retention-flagged");
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(Array.isArray(body.content)).toBe(true);
      expect(typeof body.total).toBe("number");
    });

    it("GET /api/v1/connectors/retention-flagged with analyst token returns 403 (admin-only)", async () => {
      const res = await authInject(app, analystToken, "GET", "/api/v1/connectors/retention-flagged");
      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.payload).error).toBe("FORBIDDEN");
    });

    it("GET /api/v1/connectors/retention-flagged supports pagination", async () => {
      const res = await authInject(app, adminToken, "GET", "/api/v1/connectors/retention-flagged?limit=5&offset=0");
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.content.length).toBeLessThanOrEqual(5);
    });
  });
});
