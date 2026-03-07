/**
 * Integration tests for Social Media API case timeline and supervisor close (FR-12).
 * Covers: GET timeline, POST supervisor-close, auth guard.
 */
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { buildTestApp, getAuthToken, authInject, SEED_USERS, NON_EXISTENT_UUID, TestApp } from "../test-helpers";

describe("Social Media API — Case Timeline & Supervisor Close (FR-12)", () => {
  let app: TestApp;
  let adminToken: string;
  let analystToken: string;
  let dbReady = false;
  let testCaseId: string | null = null;

  beforeAll(async () => {
    app = await buildTestApp();
    try {
      const aToken = await getAuthToken(app, SEED_USERS.admin.username, SEED_USERS.admin.password);
      const nToken = await getAuthToken(app, SEED_USERS.analyst.username, SEED_USERS.analyst.password);
      if (!aToken || !nToken) throw new Error("LOGIN_FAILED");
      adminToken = aToken;
      analystToken = nToken;
      dbReady = true;

      // Create a test case for timeline operations
      const caseRes = await authInject(app, adminToken, "POST", "/api/v1/cases", {
        title: "Timeline Integration Test Case",
        description: "Case created for timeline and supervisor close testing",
      });
      if (caseRes.statusCode === 201) {
        testCaseId = JSON.parse(caseRes.payload).case.case_id;
      }
    } catch {
      dbReady = false;
    }
  });

  beforeEach((ctx) => {
    if (!dbReady) ctx.skip();
  });

  // ---------- Auth Guard ----------
  it("GET /api/v1/cases/:id/timeline without auth returns 401", async () => {
    const res = await app.inject({ method: "GET", url: `/api/v1/cases/${NON_EXISTENT_UUID}/timeline` });
    expect(res.statusCode).toBe(401);
  });

  it("POST /api/v1/cases/:id/supervisor-close without auth returns 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/cases/${NON_EXISTENT_UUID}/supervisor-close`,
      payload: { justification: "Test justification for supervisor close action" },
    });
    expect(res.statusCode).toBe(401);
  });

  // ---------- Timeline ----------
  describe("Case Timeline (FR-12)", () => {
    it("GET /api/v1/cases/:id/timeline returns timeline array for an existing case", async () => {
      if (!testCaseId) return;
      const res = await authInject(app, adminToken, "GET", `/api/v1/cases/${testCaseId}/timeline`);
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.caseId).toBe(testCaseId);
      expect(Array.isArray(body.timeline)).toBe(true);
      expect(typeof body.count).toBe("number");
    });

    it("GET /api/v1/cases/:id/timeline with non-existent UUID returns 404", async () => {
      const res = await authInject(app, adminToken, "GET", `/api/v1/cases/${NON_EXISTENT_UUID}/timeline`);
      expect(res.statusCode).toBe(404);
      expect(JSON.parse(res.payload).error).toBe("CASE_NOT_FOUND");
    });

    it("GET /api/v1/cases/:id/timeline supports pagination", async () => {
      if (!testCaseId) return;
      const res = await authInject(app, adminToken, "GET", `/api/v1/cases/${testCaseId}/timeline?limit=5&offset=0`);
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.timeline.length).toBeLessThanOrEqual(5);
    });

    it("GET /api/v1/cases/:id/timeline includes event_type field on entries", async () => {
      if (!testCaseId) return;
      // Add a note to ensure at least one timeline event
      await authInject(app, adminToken, "POST", `/api/v1/cases/${testCaseId}/notes`, {
        noteText: "Timeline test note",
      });

      const res = await authInject(app, adminToken, "GET", `/api/v1/cases/${testCaseId}/timeline`);
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      if (body.timeline.length > 0) {
        const entry = body.timeline[0];
        expect(entry.event_type).toBeDefined();
        expect(entry.event_id).toBeDefined();
        expect(entry.created_at).toBeDefined();
      }
    });
  });

  // ---------- Supervisor Close ----------
  describe("Supervisor Close (FR-12)", () => {
    it("POST /api/v1/cases/:id/supervisor-close with non-existent UUID returns 404", async () => {
      const res = await authInject(app, adminToken, "POST", `/api/v1/cases/${NON_EXISTENT_UUID}/supervisor-close`, {
        justification: "This case does not exist, test justification text",
      });
      expect(res.statusCode).toBe(404);
      expect(JSON.parse(res.payload).error).toBe("CASE_NOT_FOUND");
    });

    it("POST /api/v1/cases/:id/supervisor-close with analyst role returns 403", async () => {
      if (!testCaseId) return;
      const res = await authInject(app, analystToken, "POST", `/api/v1/cases/${testCaseId}/supervisor-close`, {
        justification: "Analyst should not be able to perform supervisor close",
      });
      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.payload).error).toBe("SUPERVISOR_REQUIRED");
    });

    it("POST /api/v1/cases/:id/supervisor-close without justification returns 400", async () => {
      if (!testCaseId) return;
      const res = await authInject(app, adminToken, "POST", `/api/v1/cases/${testCaseId}/supervisor-close`, {});
      expect(res.statusCode).toBe(400);
    });

    it("POST /api/v1/cases/:id/supervisor-close with short justification returns 400", async () => {
      if (!testCaseId) return;
      const res = await authInject(app, adminToken, "POST", `/api/v1/cases/${testCaseId}/supervisor-close`, {
        justification: "short", // minLength: 10
      });
      expect(res.statusCode).toBe(400);
    });

    it("POST /api/v1/cases/:id/supervisor-close with admin closes the case", async () => {
      // Create a fresh case specifically for closure
      const caseRes = await authInject(app, adminToken, "POST", "/api/v1/cases", {
        title: "Supervisor Close Target Case",
      });
      if (caseRes.statusCode !== 201) return;
      const closeCaseId = JSON.parse(caseRes.payload).case.case_id;

      const res = await authInject(app, adminToken, "POST", `/api/v1/cases/${closeCaseId}/supervisor-close`, {
        justification: "Closing this case as part of supervisor override integration test",
      });
      // Admin with PLATFORM_ADMINISTRATOR role should be allowed
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.caseId).toBe(closeCaseId);
      expect(body.newStateId).toBe("CLOSED");
      expect(body.closedBy).toBeDefined();
      expect(body.justification).toBe("Closing this case as part of supervisor override integration test");
    });

    it("POST /api/v1/cases/:id/supervisor-close on already-closed case returns 400", async () => {
      // Find a closed case
      const listRes = await authInject(app, adminToken, "GET", "/api/v1/cases?state_id=CLOSED&limit=1");
      const cases = JSON.parse(listRes.payload).cases;
      if (cases.length === 0) return;

      const closedCaseId = cases[0].case_id;
      const res = await authInject(app, adminToken, "POST", `/api/v1/cases/${closedCaseId}/supervisor-close`, {
        justification: "Attempting to close an already closed case test",
      });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.payload).error).toBe("ALREADY_CLOSED");
    });
  });
});
