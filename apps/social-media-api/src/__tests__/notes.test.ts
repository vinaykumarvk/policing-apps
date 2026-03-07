/**
 * Integration tests for Social Media API notes and activity timeline endpoints.
 * Covers: POST notes, GET notes, GET activity for entity types.
 */
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { buildTestApp, getAuthToken, authInject, SEED_USERS, NON_EXISTENT_UUID, TestApp } from "../test-helpers";

describe("Social Media API — Notes & Activity", () => {
  let app: TestApp;
  let token: string;
  let dbReady = false;
  let testCaseId: string | null = null;

  beforeAll(async () => {
    app = await buildTestApp();
    try {
      const t = await getAuthToken(app, SEED_USERS.admin.username, SEED_USERS.admin.password);
      if (!t) throw new Error("LOGIN_FAILED");
      token = t;
      dbReady = true;

      // Create a case to attach notes to
      const caseRes = await authInject(app, token, "POST", "/api/v1/cases", {
        title: "Notes Test Case",
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

  it("GET /api/v1/cases/:id/notes on entity with no notes returns empty array", async () => {
    const entityId = testCaseId || NON_EXISTENT_UUID;
    const res = await authInject(app, token, "GET", `/api/v1/cases/${entityId}/notes`);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.notes)).toBe(true);
  });

  it("POST /api/v1/cases/:id/notes creates a note on a case", async () => {
    if (!testCaseId) return;
    const res = await authInject(app, token, "POST", `/api/v1/cases/${testCaseId}/notes`, {
      noteText: "This is an integration test note",
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.note).toBeDefined();
    expect(body.note.note_text).toBe("This is an integration test note");
    expect(body.note.entity_type).toBe("cases");
    expect(body.note.entity_id).toBe(testCaseId);
  });

  it("GET /api/v1/cases/:id/notes returns the created note", async () => {
    if (!testCaseId) return;
    const res = await authInject(app, token, "GET", `/api/v1/cases/${testCaseId}/notes`);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.notes.length).toBeGreaterThanOrEqual(1);
    const match = body.notes.find((n: any) => n.note_text === "This is an integration test note");
    expect(match).toBeDefined();
  });

  it("POST /api/v1/alerts/:id/notes with noteText creates a note on alerts entity type", async () => {
    // Use a non-existent alert ID — the notes table is entity-agnostic
    const res = await authInject(app, token, "POST", `/api/v1/alerts/${NON_EXISTENT_UUID}/notes`, {
      noteText: "Alert note test",
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.note.entity_type).toBe("alerts");
  });

  it("GET /api/v1/cases/:id/activity returns activity array", async () => {
    if (!testCaseId) return;
    const res = await authInject(app, token, "GET", `/api/v1/cases/${testCaseId}/activity`);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.activity)).toBe(true);
  });

  it("GET /api/v1/alerts/:id/activity with random entity returns activity array", async () => {
    // Use a random UUID to avoid stale data from prior runs
    const randomUuid = crypto.randomUUID();
    const res = await authInject(app, token, "GET", `/api/v1/alerts/${randomUuid}/activity`);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.activity)).toBe(true);
    expect(body.activity.length).toBe(0);
  });
});
