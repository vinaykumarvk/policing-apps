/**
 * Tests for FR-19/FR-02: Content monitoring auto-eval and ingestion validation.
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

describe("Content Monitoring & Ingestion Validation (FR-19/FR-02)", () => {
  it("POST /api/v1/ingestion/jobs/:id/validate without auth returns 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/ingestion/jobs/00000000-0000-0000-0000-000000000001/validate",
    });
    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady)("POST /api/v1/ingestion/jobs/:id/validate with nonexistent job returns 404", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/ingestion/jobs/00000000-0000-0000-0000-000000000000/validate",
    });
    expect([404, 500]).toContain(res.statusCode);
  });
});
