/**
 * Integration tests for Social Media API task inbox routes.
 * Covers: GET task inbox, POST task action (via @puda/api-core createTaskRoutes).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, getAuthToken, authInject, isDatabaseReady, SEED_USERS, NON_EXISTENT_UUID } from "../test-helpers";
import { FastifyInstance } from "fastify";

describe("Social Media API — Tasks", () => {
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

  it("GET /api/v1/tasks/inbox without auth returns 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/tasks/inbox" });
    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady)("GET /api/v1/tasks/inbox returns tasks with pagination", async () => {
    const res = await authInject(app, token, "GET", "/api/v1/tasks/inbox?limit=10&offset=0");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.tasks)).toBe(true);
    expect(typeof body.total).toBe("number");
  });

  it.skipIf(!dbReady)("POST /api/v1/tasks/:id/action with non-existent task returns 404", async () => {
    const res = await authInject(app, token, "POST", `/api/v1/tasks/${NON_EXISTENT_UUID}/action`, {
      action: "APPROVE",
    });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("TASK_NOT_FOUND");
  });

  it.skipIf(!dbReady)("POST /api/v1/tasks/:id/action without action field returns 400", async () => {
    const res = await authInject(app, token, "POST", `/api/v1/tasks/${NON_EXISTENT_UUID}/action`, {});
    // Schema requires action field
    expect(res.statusCode).toBe(400);
  });
});
