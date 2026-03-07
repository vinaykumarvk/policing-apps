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
let adminToken: string;
let examinerToken: string;
let dbReady = false;

beforeAll(async () => {
  app = await buildTestApp();
  const t1 = await getAuthToken(app, "admin", "password");
  const t2 = await getAuthToken(
    app,
    SEED_USERS.examiner.username,
    SEED_USERS.examiner.password,
  );
  if (t1 && t2) {
    adminToken = t1;
    examinerToken = t2;
    dbReady = true;
  }
});

afterAll(async () => {
  await app.close();
});

/* ------------------------------------------------------------------ */
/*  Admin — GET /api/v1/users                                          */
/* ------------------------------------------------------------------ */

describe("Admin — GET /api/v1/users", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/users",
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 403 for non-admin user", async () => {
    if (!dbReady) return;

    const res = await authInject(app, examinerToken, "GET", "/api/v1/users");
    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("FORBIDDEN");
  });

  it("lists users for admin", async () => {
    if (!dbReady) return;

    const res = await authInject(app, adminToken, "GET", "/api/v1/users");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.users).toBeInstanceOf(Array);
    expect(typeof body.total).toBe("number");
    expect(body.total).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/*  Admin — POST /api/v1/users                                         */
/* ------------------------------------------------------------------ */

describe("Admin — POST /api/v1/users", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/users",
      payload: {
        username: "testuser",
        password: "StrongP@ssw0rd1",
        fullName: "Test User",
      },
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 403 for non-admin user", async () => {
    if (!dbReady) return;

    const res = await authInject(app, examinerToken, "POST", "/api/v1/users", {
      username: "testuser",
      password: "StrongP@ssw0rd1",
      fullName: "Test User",
    });
    expect(res.statusCode).toBe(403);
  });

  it("rejects weak password", async () => {
    if (!dbReady) return;

    const res = await authInject(app, adminToken, "POST", "/api/v1/users", {
      username: "weakpwuser",
      password: "short",
      fullName: "Weak Password User",
    });
    // Schema validation will reject password < 12 chars
    expect(res.statusCode).toBe(400);
  });

  it("creates a new user when all fields are valid", async () => {
    if (!dbReady) return;

    const username = `testuser_${Date.now()}`;
    const res = await authInject(app, adminToken, "POST", "/api/v1/users", {
      username,
      password: "StrongP@ssw0rd!1",
      fullName: "Integration Test User",
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.user).toBeDefined();
    expect(body.user.username).toBe(username);
  });
});

/* ------------------------------------------------------------------ */
/*  Admin — PUT /api/v1/users/:id/role                                 */
/* ------------------------------------------------------------------ */

describe("Admin — PUT /api/v1/users/:id/role", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/api/v1/users/${NON_EXISTENT_UUID}/role`,
      payload: { roleId: "some-role" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 404 for non-existent user", async () => {
    if (!dbReady) return;

    const res = await authInject(
      app,
      adminToken,
      "PUT",
      `/api/v1/users/${NON_EXISTENT_UUID}/role`,
      { roleId: "some-role-id" },
    );
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("USER_NOT_FOUND");
  });
});
