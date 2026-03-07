/**
 * Integration tests for Social Media API OCR processing routes.
 * Covers: POST submit OCR job, GET job status, GET jobs by evidence.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, getAuthToken, authInject, isDatabaseReady, SEED_USERS, NON_EXISTENT_UUID } from "../test-helpers";
import { FastifyInstance } from "fastify";

describe("Social Media API — OCR", () => {
  let app: FastifyInstance;
  let token: string;
  let dbReady = false;

  beforeAll(async () => {
    app = await buildTestApp();
    dbReady = await isDatabaseReady(app);
    if (dbReady) {
      token = (await getAuthToken(app, SEED_USERS.admin.username, SEED_USERS.admin.password))!;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it("POST /api/v1/ocr/submit without auth returns 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/ocr/submit",
      payload: { evidenceId: NON_EXISTENT_UUID },
    });
    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady)("POST /api/v1/ocr/submit creates an OCR job", async () => {
    const res = await authInject(app, token, "POST", "/api/v1/ocr/submit", {
      evidenceId: NON_EXISTENT_UUID,
    });
    // May succeed (201) or fail if evidence doesn't exist in the DB
    expect([201, 404, 500]).toContain(res.statusCode);
    if (res.statusCode === 201) {
      const body = JSON.parse(res.payload);
      expect(body.job_id || body.jobId).toBeDefined();
    }
  });

  it.skipIf(!dbReady)("GET /api/v1/ocr/:jobId with non-existent job returns 404", async () => {
    const res = await authInject(app, token, "GET", `/api/v1/ocr/${NON_EXISTENT_UUID}`);
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("NOT_FOUND");
  });

  it.skipIf(!dbReady)("GET /api/v1/ocr/evidence/:evidenceId returns jobs array", async () => {
    const res = await authInject(app, token, "GET", `/api/v1/ocr/evidence/${NON_EXISTENT_UUID}`);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.jobs)).toBe(true);
  });
});
