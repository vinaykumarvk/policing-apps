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
    token = await getAuthToken(app, "officer1", "password");
  }
});

afterAll(async () => {
  await app.close();
});

describe("Search – GET /api/v1/search", () => {
  it.skipIf(!dbReady)("returns 400 when q parameter is missing", async () => {
    const res = await authInject(app, token, {
      method: "GET",
      url: "/api/v1/search",
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("VALIDATION_ERROR");
  });

  it.skipIf(!dbReady)("returns 400 when q parameter is empty", async () => {
    const res = await authInject(app, token, {
      method: "GET",
      url: "/api/v1/search?q=",
    });

    expect(res.statusCode).toBe(400);
  });

  it.skipIf(!dbReady)("returns results array and total for a valid query", async () => {
    // First, seed some data by creating a lead
    await authInject(app, token, {
      method: "POST",
      url: "/api/v1/leads",
      payload: { sourceType: "HUMINT", summary: "Searchable drug trafficking intel" },
    });

    const res = await authInject(app, token, {
      method: "GET",
      url: "/api/v1/search?q=drug",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("results");
    expect(body).toHaveProperty("total");
    expect(Array.isArray(body.results)).toBe(true);
    expect(typeof body.total).toBe("number");
  });

  it.skipIf(!dbReady)("returns empty results for a non-matching query", async () => {
    const res = await authInject(app, token, {
      method: "GET",
      url: "/api/v1/search?q=zzzznonexistent999xyz",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.results).toEqual([]);
    expect(body.total).toBe(0);
  });

  it.skipIf(!dbReady)("respects limit parameter", async () => {
    const res = await authInject(app, token, {
      method: "GET",
      url: "/api/v1/search?q=test&limit=1",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.results.length).toBeLessThanOrEqual(1);
  });

  it.skipIf(!dbReady)("search results include entityType and entityId", async () => {
    const res = await authInject(app, token, {
      method: "GET",
      url: "/api/v1/search?q=test",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    for (const result of body.results) {
      expect(result).toHaveProperty("entityType");
      expect(result).toHaveProperty("entityId");
      expect(result).toHaveProperty("title");
      expect(result).toHaveProperty("snippet");
      expect(result).toHaveProperty("score");
    }
  });
});
