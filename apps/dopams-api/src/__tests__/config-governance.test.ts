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

describe("Config Governance Routes", () => {
  it("GET /api/v1/config/versions without auth returns 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/config/versions",
    });

    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady)("GET /api/v1/config/versions returns config versions list", async () => {
    const res = await authInject(app, token, { method: "GET", url: "/api/v1/config/versions" });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("versions");
    expect(Array.isArray(body.versions)).toBe(true);
    expect(body).toHaveProperty("total");
    expect(typeof body.total).toBe("number");
  });

  it.skipIf(!dbReady)("POST /api/v1/config/versions creates a draft config version", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/config/versions",
      payload: {
        configType: `test-config-${Date.now()}`,
        content: { setting1: "value1", setting2: true },
        description: "Integration test config version",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("version");
    expect(body.version).toHaveProperty("id");
    expect(body.version.status).toBe("DRAFT");
    expect(body.version.version_number).toBe(1);
  });

  it.skipIf(!dbReady)("POST /api/v1/config/versions rejects missing required fields", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/config/versions",
      payload: {
        // missing configType and content
        description: "Invalid config",
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it.skipIf(!dbReady)("GET /api/v1/config/versions/:id returns 404 for non-existent version", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await authInject(app, token, {
      method: "GET",
      url: `/api/v1/config/versions/${fakeId}`,
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("VERSION_NOT_FOUND");
  });
});
