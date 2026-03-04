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
    token = await getAuthToken(app, "officer1", "password");
  }
});

afterAll(async () => {
  await app.close();
});

describe("Notifications – GET /api/v1/notifications/count", () => {
  it.skipIf(!dbReady)("returns an unread count", async () => {
    const res = await authInject(app, token, {
      method: "GET",
      url: "/api/v1/notifications/count",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("unread");
    expect(typeof body.unread).toBe("number");
    expect(body.unread).toBeGreaterThanOrEqual(0);
  });
});

describe("Notifications – GET /api/v1/notifications", () => {
  it.skipIf(!dbReady)("returns a list of notifications with total", async () => {
    const res = await authInject(app, token, {
      method: "GET",
      url: "/api/v1/notifications",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("notifications");
    expect(body).toHaveProperty("total");
    expect(Array.isArray(body.notifications)).toBe(true);
    expect(typeof body.total).toBe("number");
  });

  it.skipIf(!dbReady)("supports limit and offset query params", async () => {
    const res = await authInject(app, token, {
      method: "GET",
      url: "/api/v1/notifications?limit=5&offset=0",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.notifications.length).toBeLessThanOrEqual(5);
  });

  it.skipIf(!dbReady)("supports unread filter", async () => {
    const res = await authInject(app, token, {
      method: "GET",
      url: "/api/v1/notifications?unread=true",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body.notifications)).toBe(true);
  });
});

describe("Notifications – PATCH /api/v1/notifications/:id/read", () => {
  it.skipIf(!dbReady)("returns 404 for non-existent notification", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await authInject(app, token, {
      method: "PATCH",
      url: `/api/v1/notifications/${fakeId}/read`,
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("NOTIFICATION_NOT_FOUND");
  });
});
