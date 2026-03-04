import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  buildTestApp,
  getAuthToken,
  authInject,
  TestApp,
  SEED_USERS,
  NON_EXISTENT_UUID,
} from "../test-helpers";

let app: TestApp;
let token: string;
let dbReady = false;
let testCaseId: string;

beforeAll(async () => {
  app = await buildTestApp();
  const t = await getAuthToken(
    app,
    SEED_USERS.examiner.username,
    SEED_USERS.examiner.password,
  );
  if (t) {
    token = t;
    dbReady = true;
    // Create a case to attach notes to
    const caseRes = await authInject(app, token, "POST", "/api/v1/cases", {
      title: "Notes Test Case",
    });
    const caseBody = JSON.parse(caseRes.payload);
    testCaseId = caseBody.case?.case_id;
  }
});

afterAll(async () => {
  await app.close();
});

describe("Notes — POST /api/v1/:entityType/:entityId/notes", () => {
  it("creates a note on a case", async () => {
    if (!dbReady || !testCaseId) return;

    const res = await authInject(
      app,
      token,
      "POST",
      `/api/v1/forensic_case/${testCaseId}/notes`,
      { noteText: "This is a test note from integration tests." },
    );
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.note).toBeDefined();
    expect(body.note.note_id).toBeDefined();
    expect(body.note.note_text).toBe("This is a test note from integration tests.");
    expect(body.note.entity_type).toBe("forensic_case");
    expect(body.note.entity_id).toBe(testCaseId);
  });

  it("creates a second note on the same case", async () => {
    if (!dbReady || !testCaseId) return;

    const res = await authInject(
      app,
      token,
      "POST",
      `/api/v1/forensic_case/${testCaseId}/notes`,
      { noteText: "Second note on the same case." },
    );
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.note.note_text).toBe("Second note on the same case.");
  });
});

describe("Notes — GET /api/v1/:entityType/:entityId/notes", () => {
  it("lists notes for a case", async () => {
    if (!dbReady || !testCaseId) return;

    const res = await authInject(
      app,
      token,
      "GET",
      `/api/v1/forensic_case/${testCaseId}/notes`,
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.notes).toBeInstanceOf(Array);
    expect(body.notes.length).toBeGreaterThanOrEqual(2);
    // Notes should be ordered by created_at DESC
    expect(body.notes[0].note_text).toBe("Second note on the same case.");
  });

  it("returns empty array for entity with no notes", async () => {
    if (!dbReady) return;

    const res = await authInject(
      app,
      token,
      "GET",
      `/api/v1/forensic_case/${NON_EXISTENT_UUID}/notes`,
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.notes).toBeInstanceOf(Array);
    expect(body.notes.length).toBe(0);
  });
});

describe("Activity — GET /api/v1/:entityType/:entityId/activity", () => {
  it("returns activity timeline for a case", async () => {
    if (!dbReady || !testCaseId) return;

    const res = await authInject(
      app,
      token,
      "GET",
      `/api/v1/forensic_case/${testCaseId}/activity`,
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.activity).toBeInstanceOf(Array);
  });

  it("returns empty activity for non-existent entity", async () => {
    if (!dbReady) return;

    const res = await authInject(
      app,
      token,
      "GET",
      `/api/v1/forensic_case/${NON_EXISTENT_UUID}/activity`,
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.activity).toBeInstanceOf(Array);
    expect(body.activity.length).toBe(0);
  });
});
