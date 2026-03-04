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

describe("Notifications — GET /api/v1/notifications/count", () => {
  it("returns unread notification count", async () => {
    if (!dbReady) return;

    const res = await authInject(app, token, "GET", "/api/v1/notifications/count");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(typeof body.unread).toBe("number");
    expect(body.unread).toBeGreaterThanOrEqual(0);
  });
});

describe("Notifications — GET /api/v1/notifications", () => {
  it("returns a paginated list of notifications", async () => {
    if (!dbReady) return;

    const res = await authInject(app, token, "GET", "/api/v1/notifications");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.notifications).toBeInstanceOf(Array);
    expect(typeof body.total).toBe("number");
  });

  it("supports unread filter", async () => {
    if (!dbReady) return;

    const res = await authInject(
      app,
      token,
      "GET",
      "/api/v1/notifications?unread=true",
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.notifications).toBeInstanceOf(Array);
  });

  it("supports limit and offset", async () => {
    if (!dbReady) return;

    const res = await authInject(
      app,
      token,
      "GET",
      "/api/v1/notifications?limit=3&offset=0",
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.notifications.length).toBeLessThanOrEqual(3);
  });
});

describe("Notifications — PATCH /api/v1/notifications/:id/read", () => {
  it("returns 404 for non-existent notification", async () => {
    if (!dbReady) return;

    const res = await authInject(
      app,
      token,
      "PATCH",
      `/api/v1/notifications/${NON_EXISTENT_UUID}/read`,
    );
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("NOTIFICATION_NOT_FOUND");
  });
});
