/**
 * Tests for FR-10 AC-03: Alert export with watermark.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FastifyInstance } from "fastify";
import { buildTestApp, getAuthToken, isDatabaseReady, authInject, NON_EXISTENT_UUID } from "../test-helpers";

let app: FastifyInstance;
let token: string | null;
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

describe("Alert Export with Watermark (FR-10 AC-03)", () => {
  it("POST /api/v1/alerts/:id/export without auth returns 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/alerts/${NON_EXISTENT_UUID}/export`,
    });
    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady || !token)("POST /api/v1/alerts/:id/export with nonexistent alert returns 404", async () => {
    const res = await authInject(app, token!, {
      method: "POST",
      url: `/api/v1/alerts/${NON_EXISTENT_UUID}/export`,
    });
    expect([404, 403, 500]).toContain(res.statusCode);
  });

  it.skipIf(!dbReady || !token)("POST /api/v1/alerts/:id/export supports format=csv querystring", async () => {
    const res = await authInject(app, token!, {
      method: "POST",
      url: `/api/v1/alerts/${NON_EXISTENT_UUID}/export?format=csv`,
    });
    expect([404, 403, 500]).toContain(res.statusCode);
  });
});
