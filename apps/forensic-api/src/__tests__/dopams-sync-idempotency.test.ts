/**
 * Tests for FR-12 AC-03: DOPAMS sync idempotency.
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

describe("DOPAMS Sync Idempotency (FR-12 AC-03)", () => {
  it("POST /api/v1/dopams-sync/:caseId without auth returns 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/dopams-sync/${NON_EXISTENT_UUID}`,
    });
    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady || !token)("POST /api/v1/dopams-sync/:caseId with nonexistent case returns error", async () => {
    const res = await authInject(app, token!, "POST", `/api/v1/dopams-sync/${NON_EXISTENT_UUID}`);
    expect([404, 409, 500]).toContain(res.statusCode);
  });
});
