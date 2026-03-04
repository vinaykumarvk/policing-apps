import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FastifyInstance } from "fastify";
import { buildTestApp, getAuthToken, isDatabaseReady, authInject } from "../test-helpers";

let app: FastifyInstance;
let token: string;
let dbReady = false;
let testLeadId: string;

beforeAll(async () => {
  app = await buildTestApp();
  dbReady = await isDatabaseReady(app);
  if (dbReady) {
    token = await getAuthToken(app, "officer1", "password");

    // Create a lead to attach notes to
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/leads",
      payload: { sourceType: "HUMINT", summary: "Lead for notes test" },
    });
    const body = JSON.parse(res.body);
    testLeadId = body.lead.lead_id;
  }
});

afterAll(async () => {
  await app.close();
});

describe("Notes – POST /api/v1/:entityType/:entityId/notes", () => {
  it.skipIf(!dbReady)("creates a note on a lead", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: `/api/v1/leads/${testLeadId}/notes`,
      payload: { noteText: "First investigator note" },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("note");
    expect(body.note.note_text).toBe("First investigator note");
    expect(body.note.entity_type).toBe("leads");
    expect(body.note.entity_id).toBe(testLeadId);
  });

  it.skipIf(!dbReady)("creates a second note on the same lead", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: `/api/v1/leads/${testLeadId}/notes`,
      payload: { noteText: "Follow-up note with details" },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.note.note_text).toBe("Follow-up note with details");
  });
});

describe("Notes – GET /api/v1/:entityType/:entityId/notes", () => {
  it.skipIf(!dbReady)("lists notes for a lead", async () => {
    const res = await authInject(app, token, {
      method: "GET",
      url: `/api/v1/leads/${testLeadId}/notes`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("notes");
    expect(Array.isArray(body.notes)).toBe(true);
    expect(body.notes.length).toBeGreaterThanOrEqual(2);
  });

  it.skipIf(!dbReady)("returns empty array for entity with no notes", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await authInject(app, token, {
      method: "GET",
      url: `/api/v1/leads/${fakeId}/notes`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.notes).toEqual([]);
  });
});

describe("Activity – GET /api/v1/:entityType/:entityId/activity", () => {
  it.skipIf(!dbReady)("returns activity timeline (may be empty for a new lead)", async () => {
    const res = await authInject(app, token, {
      method: "GET",
      url: `/api/v1/leads/${testLeadId}/activity`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("activity");
    expect(Array.isArray(body.activity)).toBe(true);
  });

  it.skipIf(!dbReady)("returns empty activity for non-existent entity", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await authInject(app, token, {
      method: "GET",
      url: `/api/v1/cases/${fakeId}/activity`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.activity).toEqual([]);
  });
});
