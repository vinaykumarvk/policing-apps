import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FastifyInstance } from "fastify";
import { buildTestApp, getAuthToken, isDatabaseReady, authInject } from "../test-helpers";

let app: FastifyInstance;
let token: string;
let dbReady = false;

beforeAll(async () => {
  app = await buildTestApp();
  dbReady = await isDatabaseReady(app);
  if (dbReady) {
    token = await getAuthToken(app, "officer1", "password");
  }
});

afterAll(async () => {
  await app.close();
});

// ── Alerts ──────────────────────────────────────────────────────────────────

describe("Alerts CRUD", () => {
  it.skipIf(!dbReady)("GET /api/v1/alerts returns a list with total", async () => {
    const res = await authInject(app, token, { method: "GET", url: "/api/v1/alerts" });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("alerts");
    expect(body).toHaveProperty("total");
    expect(Array.isArray(body.alerts)).toBe(true);
  });

  it.skipIf(!dbReady)("GET /api/v1/alerts/:id returns 404 for missing UUID", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await authInject(app, token, {
      method: "GET",
      url: `/api/v1/alerts/${fakeId}`,
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("ALERT_NOT_FOUND");
  });

  it.skipIf(!dbReady)("GET /api/v1/alerts/:id/transitions returns 404 for missing alert", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await authInject(app, token, {
      method: "GET",
      url: `/api/v1/alerts/${fakeId}/transitions`,
    });

    expect(res.statusCode).toBe(404);
  });
});

// ── Leads ───────────────────────────────────────────────────────────────────

describe("Leads CRUD", () => {
  it.skipIf(!dbReady)("GET /api/v1/leads returns a list with total", async () => {
    const res = await authInject(app, token, { method: "GET", url: "/api/v1/leads" });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("leads");
    expect(body).toHaveProperty("total");
    expect(Array.isArray(body.leads)).toBe(true);
  });

  it.skipIf(!dbReady)("POST /api/v1/leads creates a new lead", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/leads",
      payload: { sourceType: "HUMINT", summary: "Test lead from integration test" },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("lead");
    expect(body.lead.lead_ref).toMatch(/^DOP-LEAD-/);
    expect(body.lead.summary).toBe("Test lead from integration test");
  });

  it.skipIf(!dbReady)("GET /api/v1/leads/:id returns 404 for missing UUID", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await authInject(app, token, {
      method: "GET",
      url: `/api/v1/leads/${fakeId}`,
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("LEAD_NOT_FOUND");
  });
});

// ── Cases ───────────────────────────────────────────────────────────────────

describe("Cases CRUD", () => {
  it.skipIf(!dbReady)("GET /api/v1/cases returns a list with total", async () => {
    const res = await authInject(app, token, { method: "GET", url: "/api/v1/cases" });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("cases");
    expect(body).toHaveProperty("total");
    expect(Array.isArray(body.cases)).toBe(true);
  });

  it.skipIf(!dbReady)("POST /api/v1/cases creates a new case", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/cases",
      payload: { title: "Integration test case" },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("case");
    expect(body.case.case_number).toMatch(/^DOP-CASE-/);
    expect(body.case.title).toBe("Integration test case");
  });

  it.skipIf(!dbReady)("GET /api/v1/cases/:id returns 404 for missing UUID", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await authInject(app, token, {
      method: "GET",
      url: `/api/v1/cases/${fakeId}`,
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("CASE_NOT_FOUND");
  });
});

// ── Subjects ────────────────────────────────────────────────────────────────

describe("Subjects CRUD", () => {
  it.skipIf(!dbReady)("GET /api/v1/subjects returns a list with total", async () => {
    const res = await authInject(app, token, { method: "GET", url: "/api/v1/subjects" });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("subjects");
    expect(body).toHaveProperty("total");
    expect(Array.isArray(body.subjects)).toBe(true);
  });

  it.skipIf(!dbReady)("POST /api/v1/subjects creates a new subject", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/subjects",
      payload: { fullName: "Test Subject", aliases: ["TS"] },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("subject");
    expect(body.subject.subject_ref).toMatch(/^DOP-SUBJ-/);
    expect(body.subject.full_name).toBe("Test Subject");
  });

  it.skipIf(!dbReady)("GET /api/v1/subjects/:id returns 404 for missing UUID", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await authInject(app, token, {
      method: "GET",
      url: `/api/v1/subjects/${fakeId}`,
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("SUBJECT_NOT_FOUND");
  });
});
