/**
 * Integration tests for Social Media API connector CRUD routes.
 * Covers: access control (admin-only), create, list, get-by-id, update, filtering.
 * Prerequisites: Postgres running, migrations applied, seed run.
 */
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { buildTestApp, getAuthToken, authInject, SEED_USERS, NON_EXISTENT_UUID, TestApp } from "../test-helpers";

describe("Social Media API — Connectors", () => {
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

  // ---------- Access Control ----------
  describe("Access Control", () => {
    it("GET /api/v1/connectors without token returns 401", async () => {
      const res = await app.inject({ method: "GET", url: "/api/v1/connectors" });
      expect(res.statusCode).toBe(401);
    });

    it("GET /api/v1/connectors with analyst token returns 403 (admin-only)", async () => {
      const res = await authInject(app, analystToken, "GET", "/api/v1/connectors");
      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.payload).error).toBe("FORBIDDEN");
    });

    it("POST /api/v1/connectors with analyst token returns 403", async () => {
      const res = await authInject(app, analystToken, "POST", "/api/v1/connectors", {
        platform: "test", connectorType: "Polling",
      });
      expect(res.statusCode).toBe(403);
    });

    it("PUT /api/v1/connectors/:id with analyst token returns 403", async () => {
      const res = await authInject(app, analystToken, "PUT", `/api/v1/connectors/${NON_EXISTENT_UUID}`, {
        isActive: false,
      });
      expect(res.statusCode).toBe(403);
    });

    it("GET /api/v1/connectors/:id with analyst token returns 403", async () => {
      const res = await authInject(app, analystToken, "GET", `/api/v1/connectors/${NON_EXISTENT_UUID}`);
      expect(res.statusCode).toBe(403);
    });
  });

  // ---------- Connector CRUD ----------
  describe("CRUD", () => {
    let createdId: string;

    it("GET /api/v1/connectors returns list with total count", async () => {
      const res = await authInject(app, adminToken, "GET", "/api/v1/connectors");
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(Array.isArray(body.connectors)).toBe(true);
      expect(typeof body.total).toBe("number");
    });

    it("POST /api/v1/connectors creates a new connector", async () => {
      const res = await authInject(app, adminToken, "POST", "/api/v1/connectors", {
        platform: "test_platform",
        connectorType: "Polling",
        configJsonb: { interval: 60 },
        isActive: true,
      });
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.connector).toBeDefined();
      expect(body.connector.platform).toBe("test_platform");
      expect(body.connector.connector_type).toBe("Polling");
      expect(body.connector.is_active).toBe(true);
      expect(body.connector.connector_id).toBeDefined();
      createdId = body.connector.connector_id;
    });

    it("GET /api/v1/connectors/:id returns the created connector", async () => {
      const res = await authInject(app, adminToken, "GET", `/api/v1/connectors/${createdId}`);
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.connector.connector_id).toBe(createdId);
      expect(body.connector.platform).toBe("test_platform");
    });

    it("GET /api/v1/connectors/:id with non-existent UUID returns 404", async () => {
      const res = await authInject(app, adminToken, "GET", `/api/v1/connectors/${NON_EXISTENT_UUID}`);
      expect(res.statusCode).toBe(404);
      expect(JSON.parse(res.payload).error).toBe("CONNECTOR_NOT_FOUND");
    });

    it("GET /api/v1/connectors/:id with invalid format returns 400", async () => {
      const res = await authInject(app, adminToken, "GET", "/api/v1/connectors/not-a-uuid");
      expect(res.statusCode).toBe(400);
    });

    it("PUT /api/v1/connectors/:id toggles active to false", async () => {
      const res = await authInject(app, adminToken, "PUT", `/api/v1/connectors/${createdId}`, {
        isActive: false,
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.connector.is_active).toBe(false);
    });

    it("PUT /api/v1/connectors/:id toggles active back to true", async () => {
      const res = await authInject(app, adminToken, "PUT", `/api/v1/connectors/${createdId}`, {
        isActive: true,
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).connector.is_active).toBe(true);
    });

    it("PUT /api/v1/connectors/:id updates platform and connectorType", async () => {
      const res = await authInject(app, adminToken, "PUT", `/api/v1/connectors/${createdId}`, {
        platform: "updated_platform",
        connectorType: "Webhook",
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.connector.platform).toBe("updated_platform");
      expect(body.connector.connector_type).toBe("Webhook");
    });

    it("PUT /api/v1/connectors/:id with empty body returns 400", async () => {
      const res = await authInject(app, adminToken, "PUT", `/api/v1/connectors/${createdId}`, {});
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.payload).error).toBe("NO_FIELDS");
    });

    it("PUT /api/v1/connectors/:id with non-existent UUID returns 404", async () => {
      const res = await authInject(app, adminToken, "PUT", `/api/v1/connectors/${NON_EXISTENT_UUID}`, {
        isActive: false,
      });
      expect(res.statusCode).toBe(404);
      expect(JSON.parse(res.payload).error).toBe("CONNECTOR_NOT_FOUND");
    });

    it("GET /api/v1/connectors?is_active=true filters to active connectors only", async () => {
      const res = await authInject(app, adminToken, "GET", "/api/v1/connectors?is_active=true");
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      for (const c of body.connectors) {
        expect(c.is_active).toBe(true);
      }
    });

    it("GET /api/v1/connectors?is_active=false filters to inactive connectors only", async () => {
      // First deactivate our test connector
      await authInject(app, adminToken, "PUT", `/api/v1/connectors/${createdId}`, { isActive: false });

      const res = await authInject(app, adminToken, "GET", "/api/v1/connectors?is_active=false");
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.total).toBeGreaterThanOrEqual(1);
      for (const c of body.connectors) {
        expect(c.is_active).toBe(false);
      }
    });

    it("GET /api/v1/connectors supports pagination with limit and offset", async () => {
      const res = await authInject(app, adminToken, "GET", "/api/v1/connectors?limit=2&offset=0");
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.connectors.length).toBeLessThanOrEqual(2);
      expect(typeof body.total).toBe("number");
    });
  });
});
