/**
 * Integration tests for Social Media API evidence packaging routes.
 * Covers: unauthenticated access to package and verify endpoints.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, getAuthToken, authInject, isDatabaseReady } from "../test-helpers";
import { FastifyInstance } from "fastify";

const FAKE_UUID = "00000000-0000-0000-0000-000000000000";

describe("Social Media API — Evidence Packaging", () => {
  let app: FastifyInstance;
  let token: string;
  let dbReady = false;

  beforeAll(async () => {
    app = await buildTestApp();
    dbReady = await isDatabaseReady(app);
    if (dbReady) {
      token = await getAuthToken(app);
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it("POST /api/v1/evidence/:id/package without auth returns 401", async () => {
    const res = await app.inject({ method: "POST", url: `/api/v1/evidence/${FAKE_UUID}/package` });
    expect(res.statusCode).toBe(401);
  });

  it("GET /api/v1/evidence/:id/verify without auth returns 401", async () => {
    const res = await app.inject({ method: "GET", url: `/api/v1/evidence/${FAKE_UUID}/verify` });
    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady)("POST /api/v1/evidence/:id/package with non-existent ID returns 404", async () => {
    const res = await authInject(app, token, "POST", `/api/v1/evidence/${FAKE_UUID}/package`);
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("EVIDENCE_NOT_FOUND");
  });

  it.skipIf(!dbReady)("GET /api/v1/evidence/:id/verify with non-existent ID returns 404", async () => {
    const res = await authInject(app, token, "GET", `/api/v1/evidence/${FAKE_UUID}/verify`);
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("EVIDENCE_NOT_FOUND");
  });
});
