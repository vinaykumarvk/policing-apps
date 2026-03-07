/**
 * Integration tests for Social Media API natural-language query routes.
 * Covers: POST query, GET query history.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, getAuthToken, authInject, isDatabaseReady, SEED_USERS } from "../test-helpers";
import { FastifyInstance } from "fastify";

describe("Social Media API — NL Query", () => {
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

  it("POST /api/v1/query without auth returns 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/query",
      payload: { question: "How many alerts are open?" },
    });
    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady)("POST /api/v1/query with valid question returns result", async () => {
    const res = await authInject(app, token, "POST", "/api/v1/query", {
      question: "How many alerts are open?",
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    // Result should contain a response from the NL query service
    expect(body).toBeDefined();
  });

  it.skipIf(!dbReady)("POST /api/v1/query with empty question returns 400", async () => {
    const res = await authInject(app, token, "POST", "/api/v1/query", {
      question: "",
    });
    // Schema enforces minLength: 1, so Fastify returns 400
    expect(res.statusCode).toBe(400);
  });

  it.skipIf(!dbReady)("GET /api/v1/query/history returns query history", async () => {
    const res = await authInject(app, token, "GET", "/api/v1/query/history");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.history)).toBe(true);
  });

  it.skipIf(!dbReady)("GET /api/v1/query/history supports limit parameter", async () => {
    const res = await authInject(app, token, "GET", "/api/v1/query/history?limit=5");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.history)).toBe(true);
    expect(body.history.length).toBeLessThanOrEqual(5);
  });
});
