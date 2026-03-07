/**
 * Integration tests for Social Media API priority queue routing (FR-07)
 * and false-positive marking (FR-10).
 * Covers: queue listing by priority, false-positive transition, auth guard.
 */
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { buildTestApp, getAuthToken, authInject, SEED_USERS, NON_EXISTENT_UUID, TestApp } from "../test-helpers";

describe("Social Media API — Alert Queue & False Positive (FR-07, FR-10)", () => {
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
  it("GET /api/v1/alerts/queue/CRITICAL without auth returns 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/alerts/queue/CRITICAL" });
    expect(res.statusCode).toBe(401);
  });

  it("POST /api/v1/alerts/:id/false-positive without auth returns 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/alerts/${NON_EXISTENT_UUID}/false-positive`,
      payload: { reason: "test reason for false positive" },
    });
    expect(res.statusCode).toBe(401);
  });

  // ---------- Priority Queue Routes ----------
  describe("Priority Queue (FR-07)", () => {
    it("GET /api/v1/alerts/queue/CRITICAL returns queue, alerts array, and total", async () => {
      const res = await authInject(app, token, "GET", "/api/v1/alerts/queue/CRITICAL");
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.queue).toBe("CRITICAL");
      expect(Array.isArray(body.alerts)).toBe(true);
      expect(typeof body.total).toBe("number");
    });

    it("GET /api/v1/alerts/queue/HIGH returns queue, alerts array, and total", async () => {
      const res = await authInject(app, token, "GET", "/api/v1/alerts/queue/HIGH");
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.queue).toBe("HIGH");
      expect(Array.isArray(body.alerts)).toBe(true);
      expect(typeof body.total).toBe("number");
    });

    it("GET /api/v1/alerts/queue/MEDIUM returns queue, alerts array, and total", async () => {
      const res = await authInject(app, token, "GET", "/api/v1/alerts/queue/MEDIUM");
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.queue).toBe("MEDIUM");
      expect(Array.isArray(body.alerts)).toBe(true);
      expect(typeof body.total).toBe("number");
    });

    it("GET /api/v1/alerts/queue/LOW returns queue, alerts array, and total", async () => {
      const res = await authInject(app, token, "GET", "/api/v1/alerts/queue/LOW");
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.queue).toBe("LOW");
      expect(Array.isArray(body.alerts)).toBe(true);
      expect(typeof body.total).toBe("number");
    });

    it("GET /api/v1/alerts/queue/INVALID returns 400 for invalid queue name", async () => {
      const res = await authInject(app, token, "GET", "/api/v1/alerts/queue/INVALID");
      expect(res.statusCode).toBe(400);
    });

    it("GET /api/v1/alerts/queue/CRITICAL supports pagination", async () => {
      const res = await authInject(app, token, "GET", "/api/v1/alerts/queue/CRITICAL?limit=5&offset=0");
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.alerts.length).toBeLessThanOrEqual(5);
    });
  });

  // ---------- False Positive (FR-10) ----------
  describe("False Positive", () => {
    it("POST /api/v1/alerts/:id/false-positive with non-existent UUID returns 404", async () => {
      const res = await authInject(app, token, "POST", `/api/v1/alerts/${NON_EXISTENT_UUID}/false-positive`, {
        reason: "Test false positive reason for integration test",
      });
      expect(res.statusCode).toBe(404);
      expect(JSON.parse(res.payload).error).toBe("ALERT_NOT_FOUND");
    });

    it("POST /api/v1/alerts/:id/false-positive transitions alert to FALSE_POSITIVE", async () => {
      // Find an existing alert to mark as false positive
      const listRes = await authInject(app, token, "GET", "/api/v1/alerts?limit=1");
      const alerts = JSON.parse(listRes.payload).alerts;
      if (alerts.length === 0) return; // skip if no seed alerts

      const alertId = alerts[0].alert_id;
      // Skip if already FALSE_POSITIVE
      if (alerts[0].state_id === "FALSE_POSITIVE") return;

      const res = await authInject(app, token, "POST", `/api/v1/alerts/${alertId}/false-positive`, {
        reason: "Integration test: confirmed false positive",
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.alertId).toBe(alertId);
      expect(body.newStateId).toBe("FALSE_POSITIVE");
      expect(body.reason).toBe("Integration test: confirmed false positive");
    });

    it("POST /api/v1/alerts/:id/false-positive on already-false-positive alert returns 400", async () => {
      // Find an alert that is already FALSE_POSITIVE
      const listRes = await authInject(app, token, "GET", "/api/v1/alerts?state_id=FALSE_POSITIVE&limit=1");
      const alerts = JSON.parse(listRes.payload).alerts;
      if (alerts.length === 0) return; // skip if none exist

      const alertId = alerts[0].alert_id;
      const res = await authInject(app, token, "POST", `/api/v1/alerts/${alertId}/false-positive`, {
        reason: "Duplicate false positive attempt",
      });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.payload).error).toBe("ALREADY_FALSE_POSITIVE");
    });

    it("POST /api/v1/alerts/:id/false-positive without reason returns 400", async () => {
      const res = await authInject(app, token, "POST", `/api/v1/alerts/${NON_EXISTENT_UUID}/false-positive`, {});
      expect(res.statusCode).toBe(400);
    });
  });
});
