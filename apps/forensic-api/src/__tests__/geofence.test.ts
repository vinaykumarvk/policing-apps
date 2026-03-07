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
/*  Geofences — POST /api/v1/geofences                                */
/* ------------------------------------------------------------------ */

describe("Geofences — POST /api/v1/geofences", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/geofences",
      payload: {
        name: "Test Fence",
        geometry: { type: "Point", coordinates: [78.4867, 17.3850] },
      },
    });
    expect(res.statusCode).toBe(401);
  });

  it("creates a geofence", async () => {
    if (!dbReady) return;

    const res = await authInject(app, token, "POST", "/api/v1/geofences", {
      name: "Integration Test Geofence",
      description: "Created by integration test",
      geometry: { type: "Point", coordinates: [78.4867, 17.3850] },
      radius: 500,
      active: true,
    });
    expect(res.statusCode).toBe(201);
  });

  it("rejects geofence with missing required fields", async () => {
    if (!dbReady) return;

    const res = await authInject(app, token, "POST", "/api/v1/geofences", {
      description: "Missing name and geometry",
    });
    expect(res.statusCode).toBe(400);
  });
});

/* ------------------------------------------------------------------ */
/*  Geofences — GET /api/v1/geofences                                 */
/* ------------------------------------------------------------------ */

describe("Geofences — GET /api/v1/geofences", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/geofences",
    });
    expect(res.statusCode).toBe(401);
  });

  it("lists geofences", async () => {
    if (!dbReady) return;

    const res = await authInject(app, token, "GET", "/api/v1/geofences");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.geofences).toBeInstanceOf(Array);
  });
});

/* ------------------------------------------------------------------ */
/*  Geofences — GET /api/v1/geofences/:geofenceId                     */
/* ------------------------------------------------------------------ */

describe("Geofences — GET /api/v1/geofences/:geofenceId", () => {
  it("returns 404 for non-existent geofence", async () => {
    if (!dbReady) return;

    const res = await authInject(
      app,
      token,
      "GET",
      `/api/v1/geofences/${NON_EXISTENT_UUID}`,
    );
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("NOT_FOUND");
  });
});

/* ------------------------------------------------------------------ */
/*  Geofences — POST /api/v1/geofences/check                          */
/* ------------------------------------------------------------------ */

describe("Geofences — POST /api/v1/geofences/check", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/geofences/check",
      payload: { latitude: 17.3850, longitude: 78.4867 },
    });
    expect(res.statusCode).toBe(401);
  });

  it("checks a point against geofences", async () => {
    if (!dbReady) return;

    const res = await authInject(app, token, "POST", "/api/v1/geofences/check", {
      latitude: 17.3850,
      longitude: 78.4867,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.triggers).toBeInstanceOf(Array);
    expect(typeof body.triggered).toBe("boolean");
  });
});

/* ------------------------------------------------------------------ */
/*  Geofences — GET /api/v1/geofences/:geofenceId/events              */
/* ------------------------------------------------------------------ */

describe("Geofences — GET /api/v1/geofences/:geofenceId/events", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/geofences/${NON_EXISTENT_UUID}/events`,
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns events for a geofence", async () => {
    if (!dbReady) return;

    const res = await authInject(
      app,
      token,
      "GET",
      `/api/v1/geofences/${NON_EXISTENT_UUID}/events`,
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.events).toBeInstanceOf(Array);
  });
});

/* ------------------------------------------------------------------ */
/*  Tower Dumps — POST /api/v1/tower-dumps                             */
/* ------------------------------------------------------------------ */

describe("Tower Dumps — POST /api/v1/tower-dumps", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/tower-dumps",
      payload: {
        towerName: "Test Tower",
        latitude: 17.3850,
        longitude: 78.4867,
        startTime: "2026-01-01T00:00:00Z",
        endTime: "2026-01-01T12:00:00Z",
      },
    });
    expect(res.statusCode).toBe(401);
  });

  it("creates a tower dump", async () => {
    if (!dbReady) return;

    const res = await authInject(app, token, "POST", "/api/v1/tower-dumps", {
      towerName: "Integration Test Tower",
      towerId: "TOWER-001",
      latitude: 17.3850,
      longitude: 78.4867,
      startTime: "2026-01-01T00:00:00Z",
      endTime: "2026-01-01T12:00:00Z",
      description: "Created by integration test",
    });
    expect(res.statusCode).toBe(201);
  });
});

/* ------------------------------------------------------------------ */
/*  Tower Dumps — GET /api/v1/tower-dumps                              */
/* ------------------------------------------------------------------ */

describe("Tower Dumps — GET /api/v1/tower-dumps", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/tower-dumps",
    });
    expect(res.statusCode).toBe(401);
  });

  it("lists tower dumps", async () => {
    if (!dbReady) return;

    const res = await authInject(app, token, "GET", "/api/v1/tower-dumps");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.dumps).toBeInstanceOf(Array);
  });
});

/* ------------------------------------------------------------------ */
/*  Tower Dumps — GET /api/v1/tower-dumps/:dumpId                      */
/* ------------------------------------------------------------------ */

describe("Tower Dumps — GET /api/v1/tower-dumps/:dumpId", () => {
  it("returns 404 for non-existent tower dump", async () => {
    if (!dbReady) return;

    const res = await authInject(
      app,
      token,
      "GET",
      `/api/v1/tower-dumps/${NON_EXISTENT_UUID}`,
    );
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("NOT_FOUND");
  });
});
