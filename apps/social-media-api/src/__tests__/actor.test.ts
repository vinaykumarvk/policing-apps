/**
 * Integration tests for Social Media API actor routes.
 * Covers: list actors, actor posts, and unauthenticated access.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, getAuthToken, authInject, isDatabaseReady } from "../test-helpers";
import { FastifyInstance } from "fastify";

describe("Social Media API — Actors", () => {
  let app: FastifyInstance;
  let token: string;
  let dbReady = false;

  beforeAll(async () => {
    app = await buildTestApp();
    dbReady = await isDatabaseReady(app);
    if (dbReady) {
      token = await getAuthToken(app);
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/v1/actors without auth returns 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/actors" });
    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady)("GET /api/v1/actors returns array with total", async () => {
    const res = await authInject(app, token, "GET", "/api/v1/actors");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.actors)).toBe(true);
    expect(typeof body.total).toBe("number");
  });

  it.skipIf(!dbReady)("GET /api/v1/actors/:id/posts returns array with total", async () => {
    // List actors to find one with data, or use a non-existent UUID
    const listRes = await authInject(app, token, "GET", "/api/v1/actors?limit=1");
    const actors = JSON.parse(listRes.payload).actors;

    if (actors.length === 0) {
      // No actors in DB — test with a fake UUID should 404
      const res = await authInject(app, token, "GET", "/api/v1/actors/00000000-0000-0000-0000-000000000000/posts");
      expect(res.statusCode).toBe(404);
      return;
    }

    const actorId = actors[0].actor_id;
    const res = await authInject(app, token, "GET", `/api/v1/actors/${actorId}/posts`);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.posts)).toBe(true);
    expect(typeof body.total).toBe("number");
  });
});
