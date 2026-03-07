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

describe("Graph Routes", () => {
  it("POST /api/v1/graph/analyze without auth returns 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/graph/analyze",
      payload: { maxDepth: 3 },
    });

    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady)("POST /api/v1/graph/analyze with default depth returns 200", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/graph/analyze",
      payload: { maxDepth: 2 },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toBeDefined();
  });

  it.skipIf(!dbReady)("POST /api/v1/graph/analyze with deep depth returns 202 (async job)", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/graph/analyze",
      payload: { maxDepth: 7 },
    });

    // Depth > 5 creates an async job and returns 202
    expect(res.statusCode).toBe(202);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("message");
    expect(body).toHaveProperty("job");
  });

  it.skipIf(!dbReady)("GET /api/v1/graph/node/:entityId returns 404 for non-existent entity", async () => {
    const entityId = "00000000-0000-0000-0000-000000000099";
    const res = await authInject(app, token, {
      method: "GET",
      url: `/api/v1/graph/node/${entityId}`,
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("error", "NOT_FOUND");
  });

  it.skipIf(!dbReady)("GET /api/v1/graph/kingpins returns kingpins array", async () => {
    const res = await authInject(app, token, {
      method: "GET",
      url: "/api/v1/graph/kingpins",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("kingpins");
    expect(Array.isArray(body.kingpins)).toBe(true);
  });
});
