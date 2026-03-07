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

describe("Admin Export Routes", () => {
  it("POST /api/v1/admin/export without auth returns 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/admin/export",
      payload: {
        exportType: "SUBJECTS",
        justification: "Audit compliance export for quarterly review",
      },
    });

    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady)("POST /api/v1/admin/export with justification succeeds", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/admin/export",
      payload: {
        exportType: "SUBJECTS",
        justification: "Audit compliance export for quarterly review",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("export");
    expect(body.export).toHaveProperty("export_id");
    expect(body.export).toHaveProperty("export_type");
    expect(body.export.export_type).toBe("SUBJECTS");
    expect(body).toHaveProperty("message");
  });

  it.skipIf(!dbReady)("POST /api/v1/admin/export without justification returns 400", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/admin/export",
      payload: {
        exportType: "SUBJECTS",
      },
    });

    // Schema validation rejects because justification is required
    expect(res.statusCode).toBe(400);
  });

  it.skipIf(!dbReady)("POST /api/v1/admin/export with short justification returns 400", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/admin/export",
      payload: {
        exportType: "SUBJECTS",
        justification: "short",
      },
    });

    // justification must be at least 10 characters (schema minLength: 10)
    expect(res.statusCode).toBe(400);
  });

  it.skipIf(!dbReady)("POST /api/v1/admin/export with filters succeeds", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/admin/export",
      payload: {
        exportType: "CASES",
        filters: { status: "OPEN", dateFrom: "2025-01-01" },
        justification: "Quarterly case review for compliance audit purposes",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("export");
    expect(body.export.export_type).toBe("CASES");
  });
});
