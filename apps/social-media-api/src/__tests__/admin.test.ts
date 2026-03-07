/**
 * Integration tests for Social Media API admin routes.
 * Covers: list users, create user, role assignment (via @puda/api-core createAdminRoutes).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, getAuthToken, authInject, isDatabaseReady, SEED_USERS, NON_EXISTENT_UUID } from "../test-helpers";
import { FastifyInstance } from "fastify";

describe("Social Media API — Admin", () => {
  let app: FastifyInstance;
  let token: string;
  let dbReady = false;

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

  it("GET /api/v1/users without auth returns 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/users" });
    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady)("GET /api/v1/users returns users list", async () => {
    const res = await authInject(app, token, "GET", "/api/v1/users");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.users)).toBe(true);
    expect(typeof body.total).toBe("number");
    expect(body.users.length).toBeGreaterThanOrEqual(1);
  });

  it.skipIf(!dbReady)("POST /api/v1/users with weak password returns 400", async () => {
    const res = await authInject(app, token, "POST", "/api/v1/users", {
      username: "weakpwuser",
      password: "short",
      fullName: "Weak PW User",
    });
    // Schema validation requires minLength 12 for password, so 400
    expect(res.statusCode).toBe(400);
  });

  it.skipIf(!dbReady)("PUT /api/v1/users/:id/role with non-existent user returns 404", async () => {
    const res = await authInject(app, token, "PUT", `/api/v1/users/${NON_EXISTENT_UUID}/role`, {
      roleId: NON_EXISTENT_UUID,
    });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("USER_NOT_FOUND");
  });

  it.skipIf(!dbReady)("non-admin user is forbidden from admin routes", async () => {
    const analystToken = await getAuthToken(app, SEED_USERS.analyst.username, SEED_USERS.analyst.password);
    if (!analystToken) return;
    const res = await authInject(app, analystToken, "GET", "/api/v1/users");
    expect(res.statusCode).toBe(403);
  });
});
