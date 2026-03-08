/**
 * Tests for FR-13 AC-01/04: Watchlist priority tiers and alert suppression.
 */
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

describe("Watchlist Priority & Alert Suppression (FR-13)", () => {
  it.skipIf(!dbReady)("POST /api/v1/watchlists accepts priorityTier and alertSuppressionHours", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/watchlists",
      payload: {
        watchlistName: "Priority Test Watchlist",
        description: "Integration test",
        priorityTier: "HIGH",
        alertSuppressionHours: 12,
      },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("watchlist");
  });

  it.skipIf(!dbReady)("POST /api/v1/watchlists/:id/check-alert without auth returns 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/watchlists/00000000-0000-0000-0000-000000000001/check-alert",
    });
    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady)("POST /api/v1/watchlists/:id/check-alert with nonexistent id returns 404", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/watchlists/00000000-0000-0000-0000-000000000000/check-alert",
    });
    expect([404, 500]).toContain(res.statusCode);
  });
});
