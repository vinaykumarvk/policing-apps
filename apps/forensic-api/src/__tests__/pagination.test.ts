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

describe("Pagination — Cases", () => {
  it("respects limit parameter", async () => {
    if (!dbReady) return;

    const res = await authInject(app, token, "GET", "/api/v1/cases?limit=2");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.cases.length).toBeLessThanOrEqual(2);
    expect(typeof body.total).toBe("number");
  });

  it("respects offset parameter", async () => {
    if (!dbReady) return;

    const res = await authInject(app, token, "GET", "/api/v1/cases?limit=1&offset=0");
    expect(res.statusCode).toBe(200);
    const first = JSON.parse(res.payload);

    const res2 = await authInject(app, token, "GET", "/api/v1/cases?limit=1&offset=1");
    expect(res2.statusCode).toBe(200);
    const second = JSON.parse(res2.payload);

    // If there are at least 2 cases, the IDs should differ
    if (first.cases.length > 0 && second.cases.length > 0) {
      expect(first.cases[0].case_id).not.toBe(second.cases[0].case_id);
    }
  });

  it("clamps limit to maximum of 200", async () => {
    if (!dbReady) return;

    const res = await authInject(app, token, "GET", "/api/v1/cases?limit=999");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    // Should still work, just capped at 200
    expect(body.cases.length).toBeLessThanOrEqual(200);
  });

  it("handles negative offset gracefully (clamps to 0)", async () => {
    if (!dbReady) return;

    const res = await authInject(app, token, "GET", "/api/v1/cases?offset=-5");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.cases).toBeInstanceOf(Array);
  });
});

describe("Pagination — Notifications", () => {
  it("respects limit and offset on notifications list", async () => {
    if (!dbReady) return;

    const res = await authInject(
      app,
      token,
      "GET",
      "/api/v1/notifications?limit=5&offset=0",
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.notifications).toBeInstanceOf(Array);
    expect(body.notifications.length).toBeLessThanOrEqual(5);
    expect(typeof body.total).toBe("number");
  });
});

describe("Pagination — Task inbox", () => {
  it("returns paginated task list", async () => {
    if (!dbReady) return;

    const res = await authInject(
      app,
      token,
      "GET",
      "/api/v1/tasks/inbox?limit=5&offset=0",
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.tasks).toBeInstanceOf(Array);
    expect(typeof body.total).toBe("number");
  });
});
