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

describe("NL Query Routes", () => {
  it("POST /api/v1/query without auth returns 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/query",
      payload: { question: "How many alerts are open?" },
    });

    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady)("POST /api/v1/query with valid question returns a result", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/query",
      payload: { question: "How many alerts are open?" },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    // The NL query service returns query result data
    expect(body).toBeDefined();
  });

  it.skipIf(!dbReady)("POST /api/v1/query rejects empty question", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/query",
      payload: { question: "" },
    });

    // Schema validation requires minLength: 1, so Fastify returns 400
    expect(res.statusCode).toBe(400);
  });

  it.skipIf(!dbReady)("GET /api/v1/query/history returns history array", async () => {
    const res = await authInject(app, token, {
      method: "GET",
      url: "/api/v1/query/history",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("history");
    expect(Array.isArray(body.history)).toBe(true);
  });

  it.skipIf(!dbReady)("GET /api/v1/query/history respects limit parameter", async () => {
    const res = await authInject(app, token, {
      method: "GET",
      url: "/api/v1/query/history?limit=5",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("history");
    expect(body.history.length).toBeLessThanOrEqual(5);
  });
});
