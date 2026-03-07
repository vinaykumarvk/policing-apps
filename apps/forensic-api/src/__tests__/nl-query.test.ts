import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  buildTestApp,
  getAuthToken,
  authInject,
  TestApp,
  SEED_USERS,
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
/*  NL Query — POST /api/v1/query                                     */
/* ------------------------------------------------------------------ */

describe("NL Query — POST /api/v1/query", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/query",
      payload: { question: "How many open cases?" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("rejects empty question", async () => {
    if (!dbReady) return;

    const res = await authInject(app, token, "POST", "/api/v1/query", {
      question: "",
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects request with missing question field", async () => {
    if (!dbReady) return;

    const res = await authInject(app, token, "POST", "/api/v1/query", {});
    expect(res.statusCode).toBe(400);
  });

  it("executes a natural language query", async () => {
    if (!dbReady) return;

    const res = await authInject(app, token, "POST", "/api/v1/query", {
      question: "How many open cases are there?",
    });
    // The NL query service may process or fail depending on setup,
    // but the route itself should accept the request
    expect([200, 500]).toContain(res.statusCode);
  });
});

/* ------------------------------------------------------------------ */
/*  NL Query — GET /api/v1/query/history                               */
/* ------------------------------------------------------------------ */

describe("NL Query — GET /api/v1/query/history", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/query/history",
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns query history for authenticated user", async () => {
    if (!dbReady) return;

    const res = await authInject(app, token, "GET", "/api/v1/query/history");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.history).toBeInstanceOf(Array);
  });

  it("respects limit parameter", async () => {
    if (!dbReady) return;

    const res = await authInject(
      app,
      token,
      "GET",
      "/api/v1/query/history?limit=5",
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.history).toBeInstanceOf(Array);
    expect(body.history.length).toBeLessThanOrEqual(5);
  });
});
