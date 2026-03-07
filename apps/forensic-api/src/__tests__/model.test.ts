import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  buildTestApp,
  getAuthToken,
  authInject,
  TestApp,
  SEED_USERS,
  NON_EXISTENT_UUID,
} from "../test-helpers";

let app: TestApp;
let token: string;
let dbReady = false;

beforeAll(async () => {
  app = await buildTestApp();
  const t = await getAuthToken(
    app,
    SEED_USERS.examiner.username,
    SEED_USERS.examiner.password,
  );
  if (t) {
    token = t;
    dbReady = true;
  }
});

afterAll(async () => {
  await app.close();
});

/* ------------------------------------------------------------------ */
/*  Models — POST /api/v1/models                                       */
/* ------------------------------------------------------------------ */

describe("Models — POST /api/v1/models", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/models",
      payload: {
        modelName: "test-classifier",
        modelType: "NLP",
        version: "1.0.0",
      },
    });
    expect(res.statusCode).toBe(401);
  });

  it("registers a new model", async () => {
    if (!dbReady) return;

    const modelName = `test-model-${Date.now()}`;
    const res = await authInject(app, token, "POST", "/api/v1/models", {
      modelName,
      modelType: "NLP",
      version: "1.0.0",
      description: "Integration test model",
      framework: "TensorFlow",
    });
    expect(res.statusCode).toBe(201);
  });

  it("rejects model with missing required fields", async () => {
    if (!dbReady) return;

    const res = await authInject(app, token, "POST", "/api/v1/models", {
      modelName: "incomplete-model",
    });
    expect(res.statusCode).toBe(400);
  });
});

/* ------------------------------------------------------------------ */
/*  Models — GET /api/v1/models                                        */
/* ------------------------------------------------------------------ */

describe("Models — GET /api/v1/models", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/models",
    });
    expect(res.statusCode).toBe(401);
  });

  it("lists registered models", async () => {
    if (!dbReady) return;

    const res = await authInject(app, token, "GET", "/api/v1/models");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.models).toBeInstanceOf(Array);
  });
});

/* ------------------------------------------------------------------ */
/*  Models — GET /api/v1/models/:modelId                               */
/* ------------------------------------------------------------------ */

describe("Models — GET /api/v1/models/:modelId", () => {
  it("returns 404 for non-existent model", async () => {
    if (!dbReady) return;

    const res = await authInject(
      app,
      token,
      "GET",
      `/api/v1/models/${NON_EXISTENT_UUID}`,
    );
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("NOT_FOUND");
  });
});

/* ------------------------------------------------------------------ */
/*  Models — GET /api/v1/models/active/:modelName                      */
/* ------------------------------------------------------------------ */

describe("Models — GET /api/v1/models/active/:modelName", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/models/active/nonexistent-model",
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 404 for model with no active version", async () => {
    if (!dbReady) return;

    const res = await authInject(
      app,
      token,
      "GET",
      "/api/v1/models/active/nonexistent-model-xyz",
    );
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("NOT_FOUND");
  });
});

/* ------------------------------------------------------------------ */
/*  Models — PATCH /api/v1/models/:modelId/status                      */
/* ------------------------------------------------------------------ */

describe("Models — PATCH /api/v1/models/:modelId/status", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/models/${NON_EXISTENT_UUID}/status`,
      payload: { status: "TESTING" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 404 for non-existent model", async () => {
    if (!dbReady) return;

    const res = await authInject(
      app,
      token,
      "PATCH",
      `/api/v1/models/${NON_EXISTENT_UUID}/status`,
      { status: "TESTING" },
    );
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("NOT_FOUND");
  });

  it("updates model status through lifecycle", async () => {
    if (!dbReady) return;

    // Create a model first
    const modelName = `lifecycle-model-${Date.now()}`;
    const createRes = await authInject(app, token, "POST", "/api/v1/models", {
      modelName,
      modelType: "CLASSIFICATION",
      version: "1.0.0",
    });
    expect(createRes.statusCode).toBe(201);
    const modelId = JSON.parse(createRes.payload).model_id;
    if (!modelId) return;

    // Transition from DRAFT to TESTING
    const res = await authInject(
      app,
      token,
      "PATCH",
      `/api/v1/models/${modelId}/status`,
      { status: "TESTING" },
    );
    expect(res.statusCode).toBe(200);
  });
});

/* ------------------------------------------------------------------ */
/*  Models — PATCH /api/v1/models/:modelId/metrics                     */
/* ------------------------------------------------------------------ */

describe("Models — PATCH /api/v1/models/:modelId/metrics", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/models/${NON_EXISTENT_UUID}/metrics`,
      payload: { metrics: { accuracy: 0.95 } },
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 404 for non-existent model", async () => {
    if (!dbReady) return;

    const res = await authInject(
      app,
      token,
      "PATCH",
      `/api/v1/models/${NON_EXISTENT_UUID}/metrics`,
      { metrics: { accuracy: 0.95 } },
    );
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("NOT_FOUND");
  });
});

/* ------------------------------------------------------------------ */
/*  Models — POST /api/v1/models/:modelId/evaluations                  */
/* ------------------------------------------------------------------ */

describe("Models — POST /api/v1/models/:modelId/evaluations", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/models/${NON_EXISTENT_UUID}/evaluations`,
      payload: {
        datasetName: "test-dataset",
        results: { precision: 0.9, recall: 0.85 },
      },
    });
    expect(res.statusCode).toBe(401);
  });

  it("rejects evaluation with missing required fields", async () => {
    if (!dbReady) return;

    const res = await authInject(
      app,
      token,
      "POST",
      `/api/v1/models/${NON_EXISTENT_UUID}/evaluations`,
      { datasetName: "test-dataset" },
    );
    expect(res.statusCode).toBe(400);
  });
});

/* ------------------------------------------------------------------ */
/*  Models — GET /api/v1/models/:modelId/evaluations                   */
/* ------------------------------------------------------------------ */

describe("Models — GET /api/v1/models/:modelId/evaluations", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/models/${NON_EXISTENT_UUID}/evaluations`,
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns evaluations list", async () => {
    if (!dbReady) return;

    const res = await authInject(
      app,
      token,
      "GET",
      `/api/v1/models/${NON_EXISTENT_UUID}/evaluations`,
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.evaluations).toBeInstanceOf(Array);
  });
});

/* ------------------------------------------------------------------ */
/*  Models — POST /api/v1/models/:modelId/predictions                  */
/* ------------------------------------------------------------------ */

describe("Models — POST /api/v1/models/:modelId/predictions", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/models/${NON_EXISTENT_UUID}/predictions`,
      payload: {
        input: { text: "test input" },
        output: { label: "HIGH_RISK" },
      },
    });
    expect(res.statusCode).toBe(401);
  });

  it("rejects prediction with missing required fields", async () => {
    if (!dbReady) return;

    const res = await authInject(
      app,
      token,
      "POST",
      `/api/v1/models/${NON_EXISTENT_UUID}/predictions`,
      { input: { text: "test" } },
    );
    expect(res.statusCode).toBe(400);
  });
});

/* ------------------------------------------------------------------ */
/*  Models — GET /api/v1/models/:modelId/performance                   */
/* ------------------------------------------------------------------ */

describe("Models — GET /api/v1/models/:modelId/performance", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/models/${NON_EXISTENT_UUID}/performance`,
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns performance stats", async () => {
    if (!dbReady) return;

    const res = await authInject(
      app,
      token,
      "GET",
      `/api/v1/models/${NON_EXISTENT_UUID}/performance`,
    );
    expect(res.statusCode).toBe(200);
  });
});

/* ------------------------------------------------------------------ */
/*  Models — GET /api/v1/models/history/:modelName                     */
/* ------------------------------------------------------------------ */

describe("Models — GET /api/v1/models/history/:modelName", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/models/history/test-model",
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns version history for a model name", async () => {
    if (!dbReady) return;

    const res = await authInject(
      app,
      token,
      "GET",
      "/api/v1/models/history/nonexistent-model",
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.versions).toBeInstanceOf(Array);
  });
});
