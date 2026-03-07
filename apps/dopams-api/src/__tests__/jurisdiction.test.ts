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

describe("Jurisdiction Routes", () => {
  it("GET /api/v1/units without auth returns 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/units",
    });

    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady)("GET /api/v1/units returns units array", async () => {
    const res = await authInject(app, token, { method: "GET", url: "/api/v1/units" });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("units");
    expect(Array.isArray(body.units)).toBe(true);
  });

  it.skipIf(!dbReady)("POST /api/v1/units creates a unit", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/units",
      payload: { unitName: "Test Unit", unitType: "DISTRICT" },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("unit");
    expect(body.unit.unit_name).toBe("Test Unit");
  });

  it.skipIf(!dbReady)("POST /api/v1/units/refresh-cache triggers refresh", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/units/refresh-cache",
      payload: {},
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body).toHaveProperty("refreshedAt");
  });
});
