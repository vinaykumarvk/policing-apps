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

/* ------------------------------------------------------------------ */
/*  Tasks — GET /api/v1/tasks/inbox                                    */
/* ------------------------------------------------------------------ */

describe("Tasks — GET /api/v1/tasks/inbox", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/tasks/inbox",
    });
    expect(res.statusCode).toBe(401);
  });

  it("lists tasks in inbox", async () => {
    if (!dbReady) return;

    const res = await authInject(app, token, "GET", "/api/v1/tasks/inbox");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.tasks).toBeInstanceOf(Array);
    expect(typeof body.total).toBe("number");
  });

  it("supports pagination parameters", async () => {
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

/* ------------------------------------------------------------------ */
/*  Tasks — POST /api/v1/tasks/:id/action                              */
/* ------------------------------------------------------------------ */

describe("Tasks — POST /api/v1/tasks/:id/action", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/tasks/${NON_EXISTENT_UUID}/action`,
      payload: { action: "APPROVE" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 404 for non-existent task", async () => {
    if (!dbReady) return;

    const res = await authInject(
      app,
      token,
      "POST",
      `/api/v1/tasks/${NON_EXISTENT_UUID}/action`,
      { action: "APPROVE" },
    );
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("TASK_NOT_FOUND");
  });

  it("rejects action with missing action field", async () => {
    if (!dbReady) return;

    const res = await authInject(
      app,
      token,
      "POST",
      `/api/v1/tasks/${NON_EXISTENT_UUID}/action`,
      {},
    );
    expect(res.statusCode).toBe(400);
  });
});
