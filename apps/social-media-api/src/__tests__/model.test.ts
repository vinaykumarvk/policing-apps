/**
 * Integration tests for Social Media API model governance routes.
 * Covers: model CRUD, status update, metrics, evaluations, predictions, performance.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, getAuthToken, authInject, isDatabaseReady, SEED_USERS, NON_EXISTENT_UUID } from "../test-helpers";
import { FastifyInstance } from "fastify";

describe("Social Media API — Model Governance", () => {
  let app: FastifyInstance;
  let token: string;
  let dbReady = false;
  let createdModelId: string | null = null;

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

  it("GET /api/v1/models without auth returns 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/models" });
    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady)("POST /api/v1/models registers a new model", async () => {
    const uniqueName = "test-classifier-" + Date.now();
    const res = await authInject(app, token, "POST", "/api/v1/models", {
      modelName: uniqueName,
      modelType: "text_classifier",
      version: "1.0.0",
      description: "Integration test model",
      framework: "tensorflow",
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.model_id || body.modelId).toBeDefined();
    createdModelId = body.model_id || body.modelId || null;
  });

  it.skipIf(!dbReady)("GET /api/v1/models returns models list", async () => {
    const res = await authInject(app, token, "GET", "/api/v1/models");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.models)).toBe(true);
  });

  it.skipIf(!dbReady)("GET /api/v1/models/:modelId with non-existent ID returns 404", async () => {
    const res = await authInject(app, token, "GET", `/api/v1/models/${NON_EXISTENT_UUID}`);
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("NOT_FOUND");
  });

  it.skipIf(!dbReady)("PATCH /api/v1/models/:modelId/status with non-existent ID returns 404", async () => {
    const res = await authInject(app, token, "PATCH", `/api/v1/models/${NON_EXISTENT_UUID}/status`, {
      status: "TESTING",
    });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("NOT_FOUND");
  });

  it.skipIf(!dbReady)("PATCH /api/v1/models/:modelId/metrics with non-existent ID returns 404", async () => {
    const res = await authInject(app, token, "PATCH", `/api/v1/models/${NON_EXISTENT_UUID}/metrics`, {
      metrics: { accuracy: 0.95 },
    });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("NOT_FOUND");
  });

  it.skipIf(!dbReady)("GET /api/v1/models/:modelId/evaluations returns evaluations array", async () => {
    const modelId = createdModelId || NON_EXISTENT_UUID;
    const res = await authInject(app, token, "GET", `/api/v1/models/${modelId}/evaluations`);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.evaluations)).toBe(true);
  });

  it.skipIf(!dbReady)("GET /api/v1/models/active/:modelName with non-existent name returns 404", async () => {
    const res = await authInject(app, token, "GET", "/api/v1/models/active/nonexistent_model_name");
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("NOT_FOUND");
  });

  it.skipIf(!dbReady)("GET /api/v1/models/history/:modelName returns version history", async () => {
    const res = await authInject(app, token, "GET", "/api/v1/models/history/test-classifier");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.versions)).toBe(true);
  });
});
