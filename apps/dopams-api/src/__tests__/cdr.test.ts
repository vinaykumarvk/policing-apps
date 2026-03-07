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

describe("CDR Routes", () => {
  it.skipIf(!dbReady)("GET /api/v1/cdr/towers returns towers array", async () => {
    const res = await authInject(app, token, { method: "GET", url: "/api/v1/cdr/towers" });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("towers");
    expect(Array.isArray(body.towers)).toBe(true);
  });

  it("POST /api/v1/cdr/upload without auth returns 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/cdr/upload",
      payload: { records: [] },
    });

    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady)("POST /api/v1/analysis-jobs creates a job", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/analysis-jobs",
      payload: { jobType: "CDR_ANALYSIS" },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("job");
    expect(body.job).toHaveProperty("job_id");
  });

  it.skipIf(!dbReady)("GET /api/v1/analysis-jobs lists jobs", async () => {
    const res = await authInject(app, token, { method: "GET", url: "/api/v1/analysis-jobs" });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("jobs");
    expect(Array.isArray(body.jobs)).toBe(true);
  });
});
