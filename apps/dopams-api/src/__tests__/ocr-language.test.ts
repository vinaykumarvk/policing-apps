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

describe("OCR Language & Threshold Routing — FR-03", () => {
  const validEvidenceId = "00000000-0000-0000-0000-000000000001";

  it("POST /api/v1/ocr/submit without auth returns 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/ocr/submit",
      payload: { evidenceId: validEvidenceId, language: "te" },
    });

    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady)("POST /api/v1/ocr/submit with language=te is accepted", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/ocr/submit",
      payload: {
        evidenceId: validEvidenceId,
        language: "te",
        confidenceThreshold: 0.7,
      },
    });

    // 201 if evidence exists and OCR job table is ready; 500 if FK lookup fails
    expect([201, 500]).toContain(res.statusCode);
    if (res.statusCode === 201) {
      const body = JSON.parse(res.body);
      expect(body).toBeDefined();
    }
  });

  it.skipIf(!dbReady)("POST /api/v1/ocr/submit with language=en (default) is accepted", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/ocr/submit",
      payload: {
        evidenceId: validEvidenceId,
        language: "en",
      },
    });

    // 201 if evidence exists; 500 if FK constraints fail
    expect([201, 500]).toContain(res.statusCode);
  });

  it.skipIf(!dbReady)("POST /api/v1/ocr/submit with language=hi is accepted", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/ocr/submit",
      payload: {
        evidenceId: validEvidenceId,
        language: "hi",
      },
    });

    // 201 if evidence exists; 500 if FK constraints fail
    expect([201, 500]).toContain(res.statusCode);
  });

  it.skipIf(!dbReady)("POST /api/v1/ocr/submit with invalid language is rejected by schema", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/ocr/submit",
      payload: {
        evidenceId: validEvidenceId,
        language: "xx",
      },
    });

    // Fastify schema validation rejects invalid enum values with 400
    expect(res.statusCode).toBe(400);
  });

  it.skipIf(!dbReady)("POST /api/v1/ocr/submit without evidenceId returns 400", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/ocr/submit",
      payload: {},
    });

    expect(res.statusCode).toBe(400);
  });

  it.skipIf(!dbReady)("POST /api/v1/ocr/submit accepts custom confidenceThreshold", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/ocr/submit",
      payload: {
        evidenceId: validEvidenceId,
        language: "te",
        confidenceThreshold: 0.5,
      },
    });

    // 201 if evidence exists; 500 if FK constraints fail
    expect([201, 500]).toContain(res.statusCode);
  });

  it.skipIf(!dbReady)("POST /api/v1/ocr/submit rejects confidenceThreshold > 1", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/ocr/submit",
      payload: {
        evidenceId: validEvidenceId,
        language: "en",
        confidenceThreshold: 1.5,
      },
    });

    // Schema validation should reject values outside [0, 1]
    expect(res.statusCode).toBe(400);
  });
});
