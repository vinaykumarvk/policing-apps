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

describe("Data Lifecycle — POST /api/v1/cases/:id/legal-hold", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/cases/${NON_EXISTENT_UUID}/legal-hold`,
      payload: { reason: "Court order" },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("Data Lifecycle — POST /api/v1/cases/:id/archive", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/cases/${NON_EXISTENT_UUID}/archive`,
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("Data Lifecycle — GET /api/v1/cases/purge-pending", () => {
  it.skipIf(!dbReady)("returns an array of cases pending purge", async () => {
    const res = await authInject(app, token, "GET", "/api/v1/cases/purge-pending");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.cases).toBeInstanceOf(Array);
    expect(typeof body.total).toBe("number");
  });
});
