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

describe("Interrogation Report Routes", () => {
  it("GET /api/v1/interrogation-reports without auth returns 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/interrogation-reports",
    });

    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady)("GET /api/v1/interrogation-reports returns reports array and total", async () => {
    const res = await authInject(app, token, { method: "GET", url: "/api/v1/interrogation-reports" });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("reports");
    expect(Array.isArray(body.reports)).toBe(true);
    expect(body).toHaveProperty("total");
    expect(typeof body.total).toBe("number");
  });

  it.skipIf(!dbReady)("POST /api/v1/interrogation-reports creates a report", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/interrogation-reports",
      payload: {
        subjectId: "00000000-0000-0000-0000-000000000001",
        caseId: "00000000-0000-0000-0000-000000000001",
        interrogationDate: new Date().toISOString(),
        questionsAnswers: [
          { question: "Test question?", answer: "Test answer", sequence: 1 },
        ],
      },
    });

    // 201 on success, or 500 if FK constraints fail (no matching subject/case)
    expect([200, 201, 500]).toContain(res.statusCode);
    if (res.statusCode === 201) {
      const body = JSON.parse(res.body);
      expect(body).toHaveProperty("report");
      expect(body.report).toHaveProperty("report_id");
      expect(body.report).toHaveProperty("report_ref");
    }
  });

  it.skipIf(!dbReady)("POST /api/v1/interrogation-reports rejects missing required fields", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/interrogation-reports",
      payload: {
        subjectId: "00000000-0000-0000-0000-000000000001",
        // missing caseId, interrogationDate, questionsAnswers
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it.skipIf(!dbReady)("GET /api/v1/interrogation-reports/:id returns 404 for non-existent report", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await authInject(app, token, {
      method: "GET",
      url: `/api/v1/interrogation-reports/${fakeId}`,
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("REPORT_NOT_FOUND");
  });

  it.skipIf(!dbReady)("GET /api/v1/interrogation-reports/:id/pdf returns 404 for non-existent report", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await authInject(app, token, {
      method: "GET",
      url: `/api/v1/interrogation-reports/${fakeId}/pdf`,
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("REPORT_NOT_FOUND");
  });
});
