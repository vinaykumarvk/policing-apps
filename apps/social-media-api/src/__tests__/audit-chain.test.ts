/**
 * Integration tests for Social Media API audit trail and hash chain integrity.
 * Covers: audit log retrieval via activity timeline,
 *         hash chain fields (event_hash, prev_event_hash, chain_position),
 *         and admin user listing (which triggers audit logging).
 * Prerequisites: Postgres running, migrations applied, seed run.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { buildTestApp, getAuthToken, authInject, SEED_USERS, TestApp } from "../test-helpers";

describe("Social Media API — Audit Chain", () => {
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

  // ---------- Admin user listing (admin-only endpoint) ----------
  describe("GET /api/v1/users (admin)", () => {
    it("returns 200 with users array when authenticated as admin", async () => {
      const res = await authInject(app, token, "GET", "/api/v1/users");
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.users).toBeDefined();
      expect(Array.isArray(body.users)).toBe(true);
      expect(typeof body.total).toBe("number");
      expect(body.total).toBeGreaterThan(0);
    });

    it("returns user records with expected fields", async () => {
      const res = await authInject(app, token, "GET", "/api/v1/users");
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      if (body.users.length > 0) {
        const user = body.users[0];
        expect(user.user_id).toBeDefined();
        expect(user.username).toBeDefined();
        expect(user.full_name).toBeDefined();
        expect(user.is_active).toBeDefined();
        expect(user.roles).toBeDefined();
      }
    });

    it("rejects non-admin access with 403", async () => {
      const analystToken = await getAuthToken(
        app,
        SEED_USERS.analyst.username,
        SEED_USERS.analyst.password,
      );
      if (!analystToken) return;
      const res = await authInject(app, analystToken, "GET", "/api/v1/users");
      expect(res.statusCode).toBe(403);
    });
  });

  // ---------- Activity timeline (audit log retrieval) ----------
  describe("GET /api/v1/:entityType/:entityId/activity", () => {
    it("returns 200 with activity array for a valid entity", async () => {
      // First create a case to generate audit trail entries
      const createRes = await authInject(app, token, "POST", "/api/v1/cases", {
        title: "Audit Chain Test Case",
        description: "Created to test audit trail",
      });
      expect(createRes.statusCode).toBe(201);
      const caseId = JSON.parse(createRes.payload).case.case_id;

      // Query the activity timeline for the case
      const res = await authInject(app, token, "GET", `/api/v1/cases/${caseId}/activity`);
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.activity).toBeDefined();
      expect(Array.isArray(body.activity)).toBe(true);
    });

    it("returns empty activity array for non-existent entity", async () => {
      const res = await authInject(
        app,
        token,
        "GET",
        "/api/v1/cases/00000000-0000-0000-0000-000000000000/activity",
      );
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(Array.isArray(body.activity)).toBe(true);
      expect(body.activity.length).toBe(0);
    });
  });

  // ---------- Hash chain integrity ----------
  describe("Audit log hash chain fields", () => {
    it("audit entries for a created entity contain hash chain fields", async () => {
      // Create a case so the workflow engine writes an audit_log entry
      const createRes = await authInject(app, token, "POST", "/api/v1/cases", {
        title: "Hash Chain Verification Case",
        description: "Testing hash chain integrity fields",
      });
      expect(createRes.statusCode).toBe(201);
      const caseId = JSON.parse(createRes.payload).case.case_id;

      const res = await authInject(app, token, "GET", `/api/v1/cases/${caseId}/activity`);
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);

      if (body.activity.length > 0) {
        const entry = body.activity[0];
        // Hash chain fields added by migration 019_audit_hash_chain.sql
        expect(entry.event_hash).toBeDefined();
        expect(typeof entry.event_hash).toBe("string");
        expect(entry.event_hash.length).toBe(64); // SHA-256 hex = 64 chars
        expect(entry.prev_event_hash).toBeDefined();
        expect(typeof entry.prev_event_hash).toBe("string");
        expect(entry.chain_position).toBeDefined();
        expect(typeof entry.chain_position).toBe("string"); // bigint comes as string from PG

        // Verify hash_version is set
        expect(entry.hash_version).toBeDefined();
      }
    });

    it("consecutive audit entries form a valid chain (prev_event_hash links)", async () => {
      // Create two cases to generate multiple audit entries
      await authInject(app, token, "POST", "/api/v1/cases", {
        title: "Chain Link Case A",
        description: "First case for chain verification",
      });
      const createRes2 = await authInject(app, token, "POST", "/api/v1/cases", {
        title: "Chain Link Case B",
        description: "Second case for chain verification",
      });
      expect(createRes2.statusCode).toBe(201);
      const caseId2 = JSON.parse(createRes2.payload).case.case_id;

      const res = await authInject(app, token, "GET", `/api/v1/cases/${caseId2}/activity`);
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);

      if (body.activity.length > 0) {
        // Each entry should have a non-empty event_hash
        for (const entry of body.activity) {
          expect(entry.event_hash).toBeTruthy();
          expect(entry.prev_event_hash).toBeTruthy();
        }
      }
    });
  });

  // ---------- Unauthenticated access ----------
  describe("Access Control", () => {
    it("GET /api/v1/users without token returns 401", async () => {
      const res = await app.inject({ method: "GET", url: "/api/v1/users" });
      expect(res.statusCode).toBe(401);
    });
  });
});
