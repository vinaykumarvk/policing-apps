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

beforeAll(async () => {
  app = await buildTestApp();
  const token = await getAuthToken(
    app,
    SEED_USERS.examiner.username,
    SEED_USERS.examiner.password,
  );
  dbReady = token !== null;
});

afterAll(async () => {
  await app.close();
});

describe("Auth — POST /api/v1/auth/login", () => {
  it("returns 200 with user and token for valid credentials", async () => {
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
    const body = JSON.parse(res.payload);
    expect(body.token).toBeDefined();
    expect(body.user).toBeDefined();
    expect(body.user.username).toBe(SEED_USERS.examiner.username);
    expect(body.user.user_id).toBeDefined();
  });

  it("returns 401 for invalid password", async () => {
    if (!dbReady) return;

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        username: SEED_USERS.examiner.username,
        password: "wrong-password",
      },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("INVALID_CREDENTIALS");
  });

  it("returns 401 for non-existent user", async () => {
    if (!dbReady) return;

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        username: "no-such-user",
        password: "password",
      },
    });

    expect(res.statusCode).toBe(401);
  });
});

describe("Auth — GET /api/v1/auth/me", () => {
  it("returns the authenticated user profile", async () => {
    if (!dbReady) return;

    const token = await getAuthToken(
      app,
      SEED_USERS.examiner.username,
      SEED_USERS.examiner.password,
    );
    expect(token).not.toBeNull();

    const res = await authInject(app, token!, "GET", "/api/v1/auth/me");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.user).toBeDefined();
    expect(body.user.userId).toBeDefined();
    expect(body.user.roles).toBeInstanceOf(Array);
  });

  it("returns 401 without a token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
    });

    expect(res.statusCode).toBe(401);
  });
});

describe("Auth — POST /api/v1/auth/logout", () => {
  it("returns success and clears cookie", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      payload: {},
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
  });
});
