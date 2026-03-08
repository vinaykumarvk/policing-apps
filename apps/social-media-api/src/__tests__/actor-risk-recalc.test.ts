/**
 * Tests for FR-07 AC-03/05: Actor risk recalculation endpoint.
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

describe("Actor Risk Recalculation (FR-07)", () => {
  it("POST /api/v1/actors/:id/recalculate-risk without auth returns 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/actors/${NON_EXISTENT_UUID}/recalculate-risk`,
    });
    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady || !token)("POST /api/v1/actors/:id/recalculate-risk with nonexistent id returns 404", async () => {
    const res = await authInject(app, token!, {
      method: "POST",
      url: `/api/v1/actors/${NON_EXISTENT_UUID}/recalculate-risk`,
    });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("ACTOR_NOT_FOUND");
  });
});
