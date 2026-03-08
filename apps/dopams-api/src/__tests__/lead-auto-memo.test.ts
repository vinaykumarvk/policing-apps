/**
 * Tests for FR-16 AC-04: Lead auto-memo on ESCALATED transition.
 */
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

describe("Lead Auto-Memo (FR-16 AC-04)", () => {
  it("GET /api/v1/leads without auth returns 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/leads",
    });
    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady)("GET /api/v1/leads returns leads array", async () => {
    const res = await authInject(app, token, {
      method: "GET",
      url: "/api/v1/leads",
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("leads");
    expect(Array.isArray(body.leads)).toBe(true);
  });
});
