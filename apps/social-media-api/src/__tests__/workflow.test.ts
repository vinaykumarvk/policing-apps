/**
 * Integration tests for Social Media API workflow transition endpoints.
 * Covers: alerts, cases, evidence, and reports transition listing + execution.
 */
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { buildTestApp, getAuthToken, authInject, SEED_USERS, NON_EXISTENT_UUID, TestApp } from "../test-helpers";

describe("Social Media API — Workflow Transitions", () => {
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

  // ---------- Alert transitions ----------
  describe("Alert transitions", () => {
    it("GET /api/v1/alerts/:id/transitions with non-existent UUID returns 404", async () => {
      const res = await authInject(app, token, "GET", `/api/v1/alerts/${NON_EXISTENT_UUID}/transitions`);
      expect(res.statusCode).toBe(404);
      expect(JSON.parse(res.payload).error).toBe("ALERT_NOT_FOUND");
    });

    it("POST /api/v1/alerts/:id/transition with non-existent UUID returns error", async () => {
      const res = await authInject(app, token, "POST", `/api/v1/alerts/${NON_EXISTENT_UUID}/transition`, {
        transitionId: "fake_transition",
      });
      // Entity not found results in a 409 (transition failed) or 404
      expect([404, 409]).toContain(res.statusCode);
    });

    it("POST /api/v1/alerts/:id/transition with invalid transitionId on existing alert returns 400", async () => {
      // First, list alerts to find one if any exist
      const listRes = await authInject(app, token, "GET", "/api/v1/alerts?limit=1");
      const alerts = JSON.parse(listRes.payload).alerts;
      if (alerts.length === 0) return; // skip if no seed alerts

      const alertId = alerts[0].alert_id;
      const res = await authInject(app, token, "POST", `/api/v1/alerts/${alertId}/transition`, {
        transitionId: "nonexistent_transition_id",
      });
      // Route checks available transitions and returns 400 INVALID_TRANSITION
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.payload).error).toBe("INVALID_TRANSITION");
    });

    it("GET /api/v1/alerts/:id/transitions returns transitions array for existing alert", async () => {
      const listRes = await authInject(app, token, "GET", "/api/v1/alerts?limit=1");
      const alerts = JSON.parse(listRes.payload).alerts;
      if (alerts.length === 0) return; // skip if no seed alerts

      const alertId = alerts[0].alert_id;
      const res = await authInject(app, token, "GET", `/api/v1/alerts/${alertId}/transitions`);
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(Array.isArray(body.transitions)).toBe(true);
    });
  });

  // ---------- Case transitions ----------
  describe("Case transitions", () => {
    it("GET /api/v1/cases/:id/transitions with non-existent UUID returns 404", async () => {
      const res = await authInject(app, token, "GET", `/api/v1/cases/${NON_EXISTENT_UUID}/transitions`);
      expect(res.statusCode).toBe(404);
      expect(JSON.parse(res.payload).error).toBe("CASE_NOT_FOUND");
    });

    it("POST /api/v1/cases/:id/transition with non-existent UUID returns error", async () => {
      const res = await authInject(app, token, "POST", `/api/v1/cases/${NON_EXISTENT_UUID}/transition`, {
        transitionId: "fake_transition",
      });
      expect([404, 409]).toContain(res.statusCode);
    });
  });

  // ---------- Evidence transitions ----------
  describe("Evidence transitions", () => {
    it("GET /api/v1/evidence/:id/transitions with non-existent UUID returns 404", async () => {
      const res = await authInject(app, token, "GET", `/api/v1/evidence/${NON_EXISTENT_UUID}/transitions`);
      expect(res.statusCode).toBe(404);
      expect(JSON.parse(res.payload).error).toBe("EVIDENCE_NOT_FOUND");
    });
  });

  // ---------- Report transitions ----------
  describe("Report transitions", () => {
    it("GET /api/v1/reports/:id/transitions with non-existent UUID returns 404", async () => {
      const res = await authInject(app, token, "GET", `/api/v1/reports/${NON_EXISTENT_UUID}/transitions`);
      expect(res.statusCode).toBe(404);
      expect(JSON.parse(res.payload).error).toBe("REPORT_NOT_FOUND");
    });
  });
});
