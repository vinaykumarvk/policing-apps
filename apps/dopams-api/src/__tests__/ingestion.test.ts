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

describe("Ingestion Routes", () => {
  it("POST /api/v1/ingestion/connectors without auth returns 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/ingestion/connectors",
      payload: { connectorName: "test", connectorType: "MANUAL" },
    });

    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady)("GET /api/v1/ingestion/jobs returns jobs array", async () => {
    const res = await authInject(app, token, { method: "GET", url: "/api/v1/ingestion/jobs" });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("jobs");
    expect(Array.isArray(body.jobs)).toBe(true);
    expect(body).toHaveProperty("total");
  });

  it.skipIf(!dbReady)("GET /api/v1/ingestion/dead-letter returns dead-letter entries", async () => {
    const res = await authInject(app, token, { method: "GET", url: "/api/v1/ingestion/dead-letter" });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("entries");
    expect(Array.isArray(body.entries)).toBe(true);
  });

  it.skipIf(!dbReady)("GET /api/v1/ingestion/connectors returns connectors array", async () => {
    const res = await authInject(app, token, { method: "GET", url: "/api/v1/ingestion/connectors" });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("connectors");
    expect(Array.isArray(body.connectors)).toBe(true);
  });
});
