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

describe("Dedup Routes", () => {
  it("POST /api/v1/dedup/scan without auth returns 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/dedup/scan",
      payload: {},
    });

    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady)("GET /api/v1/dedup/candidates returns candidates array", async () => {
    const res = await authInject(app, token, { method: "GET", url: "/api/v1/dedup/candidates" });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("candidates");
    expect(Array.isArray(body.candidates)).toBe(true);
    expect(body).toHaveProperty("total");
  });

  it.skipIf(!dbReady)("POST /api/v1/dedup/scan triggers scan and returns count", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/dedup/scan",
      payload: { minSimilarity: 0.8 },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("candidatesFound");
    expect(body).toHaveProperty("minSimilarity");
  });
});
