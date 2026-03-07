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
    token = await getAuthToken(app, "admin", "password");
  }
});

afterAll(async () => {
  await app.close();
});

describe("Subject Routes", () => {
  it("GET /api/v1/subjects without auth returns 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/subjects",
    });

    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady)("GET /api/v1/subjects returns subjects array with total", async () => {
    const res = await authInject(app, token, { method: "GET", url: "/api/v1/subjects" });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("subjects");
    expect(body).toHaveProperty("total");
    expect(Array.isArray(body.subjects)).toBe(true);
    expect(typeof body.total).toBe("number");
  });

  it.skipIf(!dbReady)("GET /api/v1/subjects supports pagination via limit and offset", async () => {
    const res = await authInject(app, token, {
      method: "GET",
      url: "/api/v1/subjects?limit=3&offset=0",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("subjects");
    expect(body.subjects.length).toBeLessThanOrEqual(3);
  });

  it.skipIf(!dbReady)("GET /api/v1/subjects/facets returns facet counts", async () => {
    const res = await authInject(app, token, { method: "GET", url: "/api/v1/subjects/facets" });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("facets");
    expect(body.facets).toHaveProperty("state_id");
    expect(body.facets).toHaveProperty("gender");
    expect(Array.isArray(body.facets.state_id)).toBe(true);
    expect(Array.isArray(body.facets.gender)).toBe(true);
  });

  it.skipIf(!dbReady)("POST /api/v1/subjects creates a new subject", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/subjects",
      payload: {
        fullName: "Subject Test Integration",
        aliases: ["STI"],
        gender: "Male",
        nationality: "Indian",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("subject");
    expect(body.subject.subject_ref).toMatch(/^DOP-SUBJ-/);
    expect(body.subject).toHaveProperty("state_id");
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

  it.skipIf(!dbReady)("GET /api/v1/subjects/:id returns completeness_score for existing subject", async () => {
    // First create a subject
    const createRes = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/subjects",
      payload: {
        fullName: "Completeness Score Test",
        gender: "Female",
        nationality: "Indian",
        dateOfBirth: "1990-01-15",
      },
    });
    expect(createRes.statusCode).toBe(201);
    const created = JSON.parse(createRes.body);
    const subjectId = created.subject.subject_id;

    // Now fetch and check completeness_score
    const res = await authInject(app, token, {
      method: "GET",
      url: `/api/v1/subjects/${subjectId}`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.subject).toHaveProperty("completeness_score");
    expect(typeof body.subject.completeness_score).toBe("number");
    expect(body.subject.completeness_score).toBeGreaterThanOrEqual(0);
    expect(body.subject.completeness_score).toBeLessThanOrEqual(100);
  });

  it.skipIf(!dbReady)("PUT /api/v1/subjects/:id returns 404 for missing subject", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await authInject(app, token, {
      method: "PUT",
      url: `/api/v1/subjects/${fakeId}`,
      payload: { fullName: "Updated Name" },
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("SUBJECT_NOT_FOUND");
  });

  it.skipIf(!dbReady)("GET /api/v1/subjects/:id/transitions returns 404 for missing subject", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await authInject(app, token, {
      method: "GET",
      url: `/api/v1/subjects/${fakeId}/transitions`,
    });

    expect(res.statusCode).toBe(404);
  });

  it.skipIf(!dbReady)("POST /api/v1/subjects/:id/transition returns 404 for missing subject", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await authInject(app, token, {
      method: "POST",
      url: `/api/v1/subjects/${fakeId}/transition`,
      payload: { transitionId: "activate" },
    });

    expect(res.statusCode).toBe(404);
  });
});
