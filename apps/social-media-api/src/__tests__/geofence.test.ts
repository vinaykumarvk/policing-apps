/**
 * Integration tests for Social Media API geofence and tower dump routes.
 * Covers: geofence CRUD, point check, tower dump CRUD.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, getAuthToken, authInject, isDatabaseReady, SEED_USERS, NON_EXISTENT_UUID } from "../test-helpers";
import { FastifyInstance } from "fastify";

describe("Social Media API — Geofence", () => {
  let app: FastifyInstance;
  let token: string;
  let dbReady = false;
  let createdGeofenceId: string | null = null;

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

  it("GET /api/v1/geofences without auth returns 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/geofences" });
    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady)("POST /api/v1/geofences creates a geofence", async () => {
    const res = await authInject(app, token, "POST", "/api/v1/geofences", {
      name: "Test Geofence " + Date.now(),
      description: "Test geofence for integration test",
      geometry: {
        type: "Point",
        coordinates: [77.1025, 28.7041],
      },
      radius: 500,
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.geofence_id || body.geofenceId || body.id).toBeDefined();
    createdGeofenceId = body.geofence_id || body.geofenceId || body.id || null;
  });

  it.skipIf(!dbReady)("GET /api/v1/geofences returns geofences list", async () => {
    const res = await authInject(app, token, "GET", "/api/v1/geofences");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.geofences)).toBe(true);
  });

  it.skipIf(!dbReady)("GET /api/v1/geofences/:id with non-existent ID returns 404", async () => {
    const res = await authInject(app, token, "GET", `/api/v1/geofences/${NON_EXISTENT_UUID}`);
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("NOT_FOUND");
  });

  it.skipIf(!dbReady)("POST /api/v1/geofences/check checks point against geofences", async () => {
    const res = await authInject(app, token, "POST", "/api/v1/geofences/check", {
      latitude: 28.7041,
      longitude: 77.1025,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.triggers)).toBe(true);
    expect(typeof body.triggered).toBe("boolean");
  });

  it.skipIf(!dbReady)("GET /api/v1/geofences/:id/events returns events array", async () => {
    const geofenceId = createdGeofenceId || NON_EXISTENT_UUID;
    const res = await authInject(app, token, "GET", `/api/v1/geofences/${geofenceId}/events`);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.events)).toBe(true);
  });

  // Tower dump routes
  it.skipIf(!dbReady)("GET /api/v1/tower-dumps returns dumps list", async () => {
    const res = await authInject(app, token, "GET", "/api/v1/tower-dumps");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.dumps)).toBe(true);
  });

  it.skipIf(!dbReady)("GET /api/v1/tower-dumps/:id with non-existent ID returns 404", async () => {
    const res = await authInject(app, token, "GET", `/api/v1/tower-dumps/${NON_EXISTENT_UUID}`);
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("NOT_FOUND");
  });
});
