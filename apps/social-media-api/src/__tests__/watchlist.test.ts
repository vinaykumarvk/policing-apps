/**
 * Integration tests for Social Media API watchlist routes.
 * Covers: list watchlists, create watchlist, update watchlist.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, getAuthToken, authInject, isDatabaseReady, SEED_USERS, NON_EXISTENT_UUID } from "../test-helpers";
import { FastifyInstance } from "fastify";

describe("Social Media API — Watchlists", () => {
  let app: FastifyInstance;
  let token: string;
  let dbReady = false;
  let createdWatchlistId: string | null = null;

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

  it("GET /api/v1/watchlists without auth returns 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/watchlists" });
    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady)("POST /api/v1/watchlists creates a watchlist", async () => {
    const res = await authInject(app, token, "POST", "/api/v1/watchlists", {
      name: "Test Watchlist " + Date.now(),
      description: "Integration test watchlist",
      keywords: ["drug", "trafficking", "smuggling"],
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.watchlist).toBeDefined();
    expect(body.watchlist.watchlist_id).toBeDefined();
    expect(body.watchlist.name).toContain("Test Watchlist");
    expect(body.watchlist.is_active).toBe(true);
    createdWatchlistId = body.watchlist.watchlist_id;
  });

  it.skipIf(!dbReady)("GET /api/v1/watchlists returns watchlists with total", async () => {
    const res = await authInject(app, token, "GET", "/api/v1/watchlists");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.watchlists)).toBe(true);
    expect(typeof body.total).toBe("number");
  });

  it.skipIf(!dbReady)("GET /api/v1/watchlists supports is_active filter", async () => {
    const res = await authInject(app, token, "GET", "/api/v1/watchlists?is_active=true");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.watchlists)).toBe(true);
    // All returned watchlists should be active
    for (const wl of body.watchlists) {
      expect(wl.is_active).toBe(true);
    }
  });

  it.skipIf(!dbReady)("PUT /api/v1/watchlists/:id updates a watchlist", async () => {
    if (!createdWatchlistId) return;
    const res = await authInject(app, token, "PUT", `/api/v1/watchlists/${createdWatchlistId}`, {
      name: "Updated Watchlist Name",
      keywords: ["updated", "keywords"],
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.watchlist).toBeDefined();
    expect(body.watchlist.name).toBe("Updated Watchlist Name");
  });

  it.skipIf(!dbReady)("PUT /api/v1/watchlists/:id with non-existent ID returns 404", async () => {
    const res = await authInject(app, token, "PUT", `/api/v1/watchlists/${NON_EXISTENT_UUID}`, {
      name: "Should Not Exist",
    });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("WATCHLIST_NOT_FOUND");
  });

  it.skipIf(!dbReady)("PUT /api/v1/watchlists/:id with no fields returns 400", async () => {
    if (!createdWatchlistId) return;
    const res = await authInject(app, token, "PUT", `/api/v1/watchlists/${createdWatchlistId}`, {});
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("NO_FIELDS");
  });
});
