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

describe("Geofence Routes", () => {
  it("GET /api/v1/geofences without auth returns 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/geofences",
    });

    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady)("GET /api/v1/geofences returns geofences array", async () => {
    const res = await authInject(app, token, { method: "GET", url: "/api/v1/geofences" });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("geofences");
    expect(Array.isArray(body.geofences)).toBe(true);
  });

  it.skipIf(!dbReady)("GET /api/v1/geofences/:geofenceId returns 404 for missing geofence", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await authInject(app, token, {
      method: "GET",
      url: `/api/v1/geofences/${fakeId}`,
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("NOT_FOUND");
  });

  it.skipIf(!dbReady)("POST /api/v1/geofences/check returns trigger result", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/geofences/check",
      payload: { latitude: 28.6139, longitude: 77.2090 },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("triggers");
    expect(body).toHaveProperty("triggered");
    expect(Array.isArray(body.triggers)).toBe(true);
    expect(typeof body.triggered).toBe("boolean");
  });
});

describe("Tower Dump Routes", () => {
  it("GET /api/v1/tower-dumps without auth returns 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/tower-dumps",
    });

    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady)("GET /api/v1/tower-dumps returns dumps array", async () => {
    const res = await authInject(app, token, { method: "GET", url: "/api/v1/tower-dumps" });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("dumps");
    expect(Array.isArray(body.dumps)).toBe(true);
  });

  it.skipIf(!dbReady)("GET /api/v1/tower-dumps/:dumpId returns 404 for missing dump", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await authInject(app, token, {
      method: "GET",
      url: `/api/v1/tower-dumps/${fakeId}`,
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("NOT_FOUND");
  });
});
