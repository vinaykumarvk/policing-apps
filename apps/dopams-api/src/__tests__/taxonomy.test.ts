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

describe("Taxonomy Routes", () => {
  it("GET /api/v1/taxonomy without auth returns 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/taxonomy",
    });

    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady)("GET /api/v1/taxonomy returns categories array (tree mode)", async () => {
    const res = await authInject(app, token, { method: "GET", url: "/api/v1/taxonomy" });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("categories");
    expect(Array.isArray(body.categories)).toBe(true);
  });

  it.skipIf(!dbReady)("GET /api/v1/taxonomy?flat=true returns flat list", async () => {
    const res = await authInject(app, token, {
      method: "GET",
      url: "/api/v1/taxonomy?flat=true",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("categories");
    expect(Array.isArray(body.categories)).toBe(true);
  });

  it.skipIf(!dbReady)("POST /api/v1/taxonomy creates a new category", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/taxonomy",
      payload: {
        categoryName: "Test Category " + Date.now(),
        description: "Integration test category",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("category");
    expect(body.category).toHaveProperty("category_id");
    expect(body.category).toHaveProperty("category_name");
    expect(body.category).toHaveProperty("path");
    expect(body.category.level).toBe(0);
  });
});

describe("Classification Threshold Routes", () => {
  it("GET /api/v1/classification-thresholds without auth returns 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/classification-thresholds",
    });

    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady)("GET /api/v1/classification-thresholds returns thresholds array", async () => {
    const res = await authInject(app, token, {
      method: "GET",
      url: "/api/v1/classification-thresholds",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("thresholds");
    expect(Array.isArray(body.thresholds)).toBe(true);
  });

  it.skipIf(!dbReady)("POST /api/v1/classification-thresholds creates a threshold", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/classification-thresholds",
      payload: {
        minScore: 0,
        maxScore: 50,
        action: "NEEDS_REVIEW",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("threshold");
    expect(body.threshold).toHaveProperty("threshold_id");
    expect(body.threshold.min_score).toBe(0);
    expect(body.threshold.max_score).toBe(50);
    expect(body.threshold.action).toBe("NEEDS_REVIEW");
  });

  it.skipIf(!dbReady)("POST /api/v1/classification-thresholds rejects invalid range", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/classification-thresholds",
      payload: {
        minScore: 80,
        maxScore: 50,
        action: "AUTO_ACCEPT",
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("INVALID_RANGE");
  });
});
