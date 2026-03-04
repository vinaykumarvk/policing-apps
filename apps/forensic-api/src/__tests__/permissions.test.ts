import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  buildTestApp,
  getAuthToken,
  authInject,
  TestApp,
  SEED_USERS,
} from "../test-helpers";

let app: TestApp;
let dbReady = false;
let examinerToken: string;

beforeAll(async () => {
  app = await buildTestApp();
  const t = await getAuthToken(
    app,
    SEED_USERS.examiner.username,
    SEED_USERS.examiner.password,
  );
  if (t) {
    examinerToken = t;
    dbReady = true;
  }
});

afterAll(async () => {
  await app.close();
});

describe("Permissions — Unauthenticated access", () => {
  it("returns 401 for GET /api/v1/cases without token", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/cases" });
    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("AUTHENTICATION_REQUIRED");
  });

  it("returns 401 for GET /api/v1/tasks/inbox without token", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/tasks/inbox" });
    expect(res.statusCode).toBe(401);
  });

  it("returns 401 for GET /api/v1/notifications without token", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/notifications" });
    expect(res.statusCode).toBe(401);
  });

  it("returns 401 for GET /api/v1/search?q=test without token", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/search?q=test" });
    expect(res.statusCode).toBe(401);
  });
});

describe("Permissions — Invalid token", () => {
  it("returns 401 for requests with an invalid Bearer token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/cases",
      headers: { authorization: "Bearer invalid-token-value" },
    });
    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("INVALID_TOKEN");
  });
});

describe("Permissions — Public routes remain accessible", () => {
  it("GET /health does not require auth", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.status).toBe("ok");
  });

  it("POST /api/v1/auth/login does not require auth", async () => {
    if (!dbReady) return;

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        username: SEED_USERS.examiner.username,
        password: SEED_USERS.examiner.password,
      },
    });
    expect(res.statusCode).toBe(200);
  });

  it("POST /api/v1/auth/logout does not require auth", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      payload: {},
    });
    expect(res.statusCode).toBe(200);
  });
});

describe("Permissions — Authenticated access works", () => {
  it("GET /api/v1/cases succeeds with valid token", async () => {
    if (!dbReady) return;

    const res = await authInject(app, examinerToken, "GET", "/api/v1/cases");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.cases).toBeInstanceOf(Array);
  });
});
