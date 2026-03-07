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

describe("Task Routes", () => {
  it("GET /api/v1/tasks/inbox without auth returns 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/tasks/inbox",
    });

    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady)("GET /api/v1/tasks/inbox returns tasks array with total", async () => {
    const res = await authInject(app, token, { method: "GET", url: "/api/v1/tasks/inbox" });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("tasks");
    expect(body).toHaveProperty("total");
    expect(Array.isArray(body.tasks)).toBe(true);
    expect(typeof body.total).toBe("number");
  });

  it.skipIf(!dbReady)("GET /api/v1/tasks/inbox supports pagination", async () => {
    const res = await authInject(app, token, {
      method: "GET",
      url: "/api/v1/tasks/inbox?limit=5&offset=0",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("tasks");
    expect(body.tasks.length).toBeLessThanOrEqual(5);
  });

  it.skipIf(!dbReady)("POST /api/v1/tasks/:id/action returns 404 for missing task", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await authInject(app, token, {
      method: "POST",
      url: `/api/v1/tasks/${fakeId}/action`,
      payload: { action: "approve" },
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("TASK_NOT_FOUND");
  });
});
