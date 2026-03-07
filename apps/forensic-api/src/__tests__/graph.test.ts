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
/*  Graph — POST /api/v1/graph/analyze                                 */
/* ------------------------------------------------------------------ */

describe("Graph — POST /api/v1/graph/analyze", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/graph/analyze",
    });
    expect(res.statusCode).toBe(401);
  });

  it("runs network analysis", async () => {
    if (!dbReady) return;

    const res = await authInject(app, token, "POST", "/api/v1/graph/analyze");
    expect(res.statusCode).toBe(200);
  });
});

/* ------------------------------------------------------------------ */
/*  Graph — GET /api/v1/graph/node/:entityId                           */
/* ------------------------------------------------------------------ */

describe("Graph — GET /api/v1/graph/node/:entityId", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/graph/node/${NON_EXISTENT_UUID}`,
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 404 for non-existent node", async () => {
    if (!dbReady) return;

    const res = await authInject(
      app,
      token,
      "GET",
      `/api/v1/graph/node/${NON_EXISTENT_UUID}`,
    );
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("NOT_FOUND");
  });
});

/* ------------------------------------------------------------------ */
/*  Graph — GET /api/v1/graph/kingpins                                 */
/* ------------------------------------------------------------------ */

describe("Graph — GET /api/v1/graph/kingpins", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/graph/kingpins",
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns kingpins list", async () => {
    if (!dbReady) return;

    const res = await authInject(app, token, "GET", "/api/v1/graph/kingpins");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.kingpins).toBeInstanceOf(Array);
  });
});
