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

describe("Search — GET /api/v1/search", () => {
  it("returns 400 when q parameter is missing", async () => {
    if (!dbReady) return;

    const res = await authInject(app, token, "GET", "/api/v1/search");
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when q is empty string", async () => {
    if (!dbReady) return;

    const res = await authInject(app, token, "GET", "/api/v1/search?q=");
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when q is whitespace only", async () => {
    if (!dbReady) return;

    const res = await authInject(app, token, "GET", "/api/v1/search?q=%20%20");
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("VALIDATION_ERROR");
  });

  it("returns search results for a valid query", async () => {
    if (!dbReady) return;

    // Create a case with a distinctive title to search for
    await authInject(app, token, "POST", "/api/v1/cases", {
      title: "Searchable Forensic Evidence Alpha",
      description: "Unique description for search testing",
    });

    const res = await authInject(
      app,
      token,
      "GET",
      "/api/v1/search?q=Searchable+Forensic+Evidence+Alpha",
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.results).toBeInstanceOf(Array);
    expect(typeof body.total).toBe("number");
  });

  it("supports entity_types filter", async () => {
    if (!dbReady) return;

    const res = await authInject(
      app,
      token,
      "GET",
      "/api/v1/search?q=test&entity_types=forensic_case",
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.results).toBeInstanceOf(Array);
    // All results should be forensic_case type
    for (const result of body.results) {
      expect(result.entityType).toBe("forensic_case");
    }
  });

  it("supports fuzzy search parameter", async () => {
    if (!dbReady) return;

    const res = await authInject(
      app,
      token,
      "GET",
      "/api/v1/search?q=fornsic&fuzzy=true",
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.results).toBeInstanceOf(Array);
    expect(typeof body.total).toBe("number");
  });

  it("returns 401 when called without authentication", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/search?q=test",
    });
    expect(res.statusCode).toBe(401);
  });
});
