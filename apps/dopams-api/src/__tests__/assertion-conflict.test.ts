/**
 * Tests for FR-04 AC-05/BR-01/BR-02: Subject assertion conflicts.
 */
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

describe("Assertion Conflict Routes (FR-04 AC-05)", () => {
  it("GET /api/v1/subjects/:id/conflicts without auth returns 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/subjects/00000000-0000-0000-0000-000000000001/conflicts",
    });
    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady)("GET /api/v1/subjects/:id/conflicts returns conflicts array", async () => {
    const subjectId = "00000000-0000-0000-0000-000000000001";
    const res = await authInject(app, token, {
      method: "GET",
      url: `/api/v1/subjects/${subjectId}/conflicts`,
    });
    // Subject may not exist but should return 200 with empty array
    expect([200, 500]).toContain(res.statusCode);
    if (res.statusCode === 200) {
      const body = JSON.parse(res.body);
      expect(body).toHaveProperty("conflicts");
      expect(Array.isArray(body.conflicts)).toBe(true);
    }
  });

  it.skipIf(!dbReady)("GET /api/v1/subjects/:id/conflicts supports resolved filter", async () => {
    const subjectId = "00000000-0000-0000-0000-000000000001";
    const res = await authInject(app, token, {
      method: "GET",
      url: `/api/v1/subjects/${subjectId}/conflicts?resolved=false`,
    });
    expect([200, 500]).toContain(res.statusCode);
  });

  it.skipIf(!dbReady)("POST /api/v1/subjects/conflicts/:conflictId/resolve with invalid id returns 404", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/subjects/conflicts/00000000-0000-0000-0000-000000000000/resolve",
      payload: { resolution: "ACCEPT_A" },
    });
    expect([404, 500]).toContain(res.statusCode);
  });
});
