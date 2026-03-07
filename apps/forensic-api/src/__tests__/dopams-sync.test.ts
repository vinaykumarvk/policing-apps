import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, getAuthToken, authInject, isDatabaseReady } from "../test-helpers";
import { FastifyInstance } from "fastify";

let app: FastifyInstance;
let token: string;
let dbReady = false;

const NON_EXISTENT_UUID = "00000000-0000-0000-0000-000000000000";

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

describe("DOPAMS Sync — GET /api/v1/dopams-sync", () => {
  it.skipIf(!dbReady)("returns an array of sync events", async () => {
    const res = await authInject(app, token, "GET", "/api/v1/dopams-sync");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.events).toBeInstanceOf(Array);
    expect(typeof body.total).toBe("number");
  });
});

describe("DOPAMS Sync — POST /api/v1/dopams-sync/:caseId", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/dopams-sync/${NON_EXISTENT_UUID}`,
    });
    expect(res.statusCode).toBe(401);
  });
});
