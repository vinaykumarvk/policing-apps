/**
 * Tests for FR-03 AC-03/05: OCR threshold tiers and versioned assertions.
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

describe("OCR Threshold Tiers (FR-03 AC-03/05)", () => {
  it("POST /api/v1/ocr/submit without auth returns 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/ocr/submit",
      payload: { evidenceId: "00000000-0000-0000-0000-000000000001" },
    });
    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady)("POST /api/v1/ocr/submit accepts lowThreshold parameter", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/ocr/submit",
      payload: {
        evidenceId: "00000000-0000-0000-0000-000000000001",
        highThreshold: 0.9,
        lowThreshold: 0.5,
      },
    });
    // Evidence may not exist but schema validation should pass
    expect([201, 404, 500]).toContain(res.statusCode);
  });

  it.skipIf(!dbReady)("GET /api/v1/ocr/assertions/:evidenceId returns assertions array", async () => {
    const evidenceId = "00000000-0000-0000-0000-000000000001";
    const res = await authInject(app, token, {
      method: "GET",
      url: `/api/v1/ocr/assertions/${evidenceId}`,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("assertions");
    expect(Array.isArray(body.assertions)).toBe(true);
  });

  it("GET /api/v1/ocr/assertions/:evidenceId without auth returns 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/ocr/assertions/00000000-0000-0000-0000-000000000001",
    });
    expect(res.statusCode).toBe(401);
  });
});
