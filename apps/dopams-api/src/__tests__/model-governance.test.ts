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

describe("Model Governance Routes", () => {
  it("GET /api/v1/models without auth returns 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/models",
    });

    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady)("GET /api/v1/models returns models array", async () => {
    const res = await authInject(app, token, { method: "GET", url: "/api/v1/models" });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("models");
    expect(Array.isArray(body.models)).toBe(true);
  });

  it.skipIf(!dbReady)("POST /api/v1/models registers a new model", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/models",
      payload: {
        modelName: `test-model-${Date.now()}`,
        version: "1.0",
        modelType: "CLASSIFICATION",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("model_name");
    expect(body).toHaveProperty("model_type");
    expect(body.model_type).toBe("CLASSIFICATION");
  });

  it.skipIf(!dbReady)("POST /api/v1/models rejects missing required fields", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/models",
      payload: {
        modelName: "incomplete-model",
      },
    });

    // Schema validation should reject this (missing modelType and version)
    expect(res.statusCode).toBe(400);
  });

  it.skipIf(!dbReady)("GET /api/v1/models/:modelId returns 404 for non-existent model", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await authInject(app, token, {
      method: "GET",
      url: `/api/v1/models/${fakeId}`,
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("NOT_FOUND");
  });
});
