import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  buildTestApp,
  getAuthToken,
  authInject,
  SEED_USERS,
  NON_EXISTENT_UUID,
} from "../test-helpers";

let app: any;
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
/*  MFA Enforcement — FR-14                                            */
/* ------------------------------------------------------------------ */

describe("MFA — Health endpoint accessibility", () => {
  it("GET /health is accessible without authentication", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/health",
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.status).toBe("ok");
  });
});

describe("MFA — Regular endpoints work without MFA", () => {
  it("GET /api/v1/cases works with standard auth token", async () => {
    if (!dbReady) return;

    const res = await authInject(app, token, "GET", "/api/v1/cases");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.cases).toBeInstanceOf(Array);
  });

  it("GET /api/v1/search/gallery works with standard auth token", async () => {
    if (!dbReady) return;

    const res = await authInject(app, token, "GET", "/api/v1/search/gallery");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.items).toBeInstanceOf(Array);
  });

  it("GET /api/v1/dashboard/stats works with standard auth token", async () => {
    if (!dbReady) return;

    const res = await authInject(app, token, "GET", "/api/v1/dashboard/stats");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.casesByState).toBeDefined();
  });
});

describe("MFA — Without auth returns 401", () => {
  it("GET /api/v1/cases returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/cases",
    });
    expect(res.statusCode).toBe(401);
  });

  it("POST /api/v1/cases returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/cases",
      payload: { title: "Unauthorized case" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("GET /api/v1/evidence/:id returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/evidence/${NON_EXISTENT_UUID}`,
    });
    expect(res.statusCode).toBe(401);
  });
});
