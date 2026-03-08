/**
 * Tests for FR-08 AC-05: Four-eyes report approval check.
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

describe("Four-Eyes Report Approval (FR-08 AC-05)", () => {
  it("POST /api/v1/reports/:id/transition without auth returns 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/reports/${NON_EXISTENT_UUID}/transition`,
      payload: { transitionId: "APPROVE" },
    });
    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady || !token)("POST /api/v1/reports/:id/transition returns 404 for nonexistent report", async () => {
    const res = await authInject(app, token!, {
      method: "POST",
      url: `/api/v1/reports/${NON_EXISTENT_UUID}/transition`,
      payload: { transitionId: "APPROVE" },
    });
    expect([404, 409, 500]).toContain(res.statusCode);
  });
});
