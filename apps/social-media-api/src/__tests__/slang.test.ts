/**
 * Integration tests for Social Media API slang dictionary routes.
 * Covers: list, submit for review, bulk import, and unauthenticated access.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, getAuthToken, authInject, isDatabaseReady } from "../test-helpers";
import { FastifyInstance } from "fastify";

describe("Social Media API — Slang Dictionary", () => {
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

  it("GET /api/v1/slang without auth returns 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/slang" });
    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady)("GET /api/v1/slang returns entries with total", async () => {
    const res = await authInject(app, token, "GET", "/api/v1/slang");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.entries)).toBe(true);
    expect(typeof body.total).toBe("number");
  });

  it.skipIf(!dbReady)("POST /api/v1/slang/submit creates entry with PENDING status", async () => {
    const res = await authInject(app, token, "POST", "/api/v1/slang/submit", {
      term: "testslang_" + Date.now(),
      normalizedForm: "test slang term",
      category: "integration_test",
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.entry).toBeDefined();
    expect(body.entry.submission_status).toBe("PENDING");
    expect(body.entry.slang_id).toBeDefined();
  });

  it.skipIf(!dbReady)("POST /api/v1/slang/bulk imports entries", async () => {
    const uniqueSuffix = Date.now();
    const res = await authInject(app, token, "POST", "/api/v1/slang/bulk", {
      entries: [
        { term: `bulkterm1_${uniqueSuffix}`, normalizedForm: "bulk one", category: "test" },
        { term: `bulkterm2_${uniqueSuffix}`, normalizedForm: "bulk two", category: "test" },
      ],
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.imported).toBe(2);
    expect(body.total).toBe(2);
  });
});
