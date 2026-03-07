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

describe("Watchlist Routes", () => {
  it("GET /api/v1/watchlists without auth returns 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/watchlists",
    });

    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady)("GET /api/v1/watchlists returns watchlists array", async () => {
    const res = await authInject(app, token, { method: "GET", url: "/api/v1/watchlists" });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("watchlists");
    expect(Array.isArray(body.watchlists)).toBe(true);
    expect(body).toHaveProperty("total");
  });

  it.skipIf(!dbReady)("POST /api/v1/watchlists creates a watchlist entry", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/watchlists",
      payload: { watchlistName: "Integration Test Watchlist", description: "Test" },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("watchlist");
    expect(body.watchlist.watchlist_name).toBe("Integration Test Watchlist");
  });
});
