import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FastifyInstance } from "fastify";
import { buildTestApp, getAuthToken, isDatabaseReady, authInject } from "../test-helpers";

let app: FastifyInstance;
let dbReady = false;

beforeAll(async () => {
  app = await buildTestApp();
  dbReady = await isDatabaseReady(app);
});

afterAll(async () => {
  await app.close();
});

describe("Auth – POST /api/v1/auth/login", () => {
  it.skipIf(!dbReady)("returns user and token for valid credentials (admin)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { username: "admin", password: "password" },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("token");
    expect(body).toHaveProperty("user");
    expect(body.user.username).toBe("admin");
    expect(body.user.user_type).toBe("ADMINISTRATOR");
  });

  it.skipIf(!dbReady)("returns user and token for officer1", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { username: "officer1", password: "password" },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.token).toBeTruthy();
    expect(body.user.username).toBe("officer1");
  });

  it.skipIf(!dbReady)("returns 401 for wrong password", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { username: "admin", password: "wrong" },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("INVALID_CREDENTIALS");
  });

  it.skipIf(!dbReady)("returns 401 for non-existent user", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { username: "nobody", password: "password" },
    });

    expect(res.statusCode).toBe(401);
  });
});

describe("Auth – GET /api/v1/auth/me", () => {
  it.skipIf(!dbReady)("returns current user when authenticated", async () => {
    const token = await getAuthToken(app, "admin", "password");
    const res = await authInject(app, token, { method: "GET", url: "/api/v1/auth/me" });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("user");
    expect(body.user.userId).toBeTruthy();
  });

  it("returns 401 when no token is provided", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
    });

    expect(res.statusCode).toBe(401);
  });
});

describe("Auth – POST /api/v1/auth/logout", () => {
  it("returns success on logout", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      payload: {},
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
  });
});
