/**
 * Integration tests for Social Media API config routes.
 * Covers: workflow listing, workflow detail, roles list, SLA config.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, getAuthToken, authInject, isDatabaseReady, SEED_USERS } from "../test-helpers";
import { FastifyInstance } from "fastify";

describe("Social Media API — Config", () => {
  let app: FastifyInstance;
  let token: string;
  let dbReady = false;

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

  it("GET /api/v1/config/workflows without auth returns 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/config/workflows" });
    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady)("GET /api/v1/config/workflows returns workflow list", async () => {
    const res = await authInject(app, token, "GET", "/api/v1/config/workflows");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.workflows)).toBe(true);
    // Each workflow should have workflowId, entityType, stateCount, transitionCount
    if (body.workflows.length > 0) {
      const wf = body.workflows[0];
      expect(wf.entityType).toBeDefined();
      expect(typeof wf.stateCount).toBe("number");
      expect(typeof wf.transitionCount).toBe("number");
    }
  });

  it.skipIf(!dbReady)("GET /api/v1/config/workflows/:entityType with unknown type returns 404", async () => {
    const res = await authInject(app, token, "GET", "/api/v1/config/workflows/nonexistent");
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("WORKFLOW_NOT_FOUND");
  });

  it.skipIf(!dbReady)("GET /api/v1/config/roles returns roles array", async () => {
    const res = await authInject(app, token, "GET", "/api/v1/config/roles");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.roles)).toBe(true);
    expect(typeof body.total).toBe("number");
  });

  it.skipIf(!dbReady)("GET /api/v1/config/sla returns SLA configuration", async () => {
    const res = await authInject(app, token, "GET", "/api/v1/config/sla");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.slaConfig)).toBe(true);
  });
});
