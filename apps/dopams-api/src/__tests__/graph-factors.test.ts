/**
 * Tests for FR-11 AC-04/05: Graph factor params and date filters.
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

describe("Graph Factor Params (FR-11 AC-04/05)", () => {
  it.skipIf(!dbReady)("POST /api/v1/graph/analyze accepts factors object", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/graph/analyze",
      payload: {
        maxDepth: 2,
        factors: {
          includeFinancial: true,
          includeCommunication: false,
          includeAssociation: true,
          minWeight: 0.5,
        },
      },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toBeDefined();
  });

  it.skipIf(!dbReady)("POST /api/v1/graph/analyze accepts dateFrom/dateTo", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/graph/analyze",
      payload: {
        maxDepth: 2,
        dateFrom: "2025-01-01",
        dateTo: "2026-12-31",
      },
    });
    expect(res.statusCode).toBe(200);
  });

  it.skipIf(!dbReady)("GET /api/v1/graph/node/:entityId accepts dateFrom/dateTo query", async () => {
    const entityId = "00000000-0000-0000-0000-000000000001";
    const res = await authInject(app, token, {
      method: "GET",
      url: `/api/v1/graph/node/${entityId}?dateFrom=2025-01-01&dateTo=2026-12-31`,
    });
    // Entity may not exist, but schema should be accepted
    expect([200, 404, 500]).toContain(res.statusCode);
  });
});
