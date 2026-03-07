/**
 * Integration tests for Social Media API glossary/translate routes.
 * Covers: list glossary, create glossary entry, and unauthenticated access.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, getAuthToken, authInject, isDatabaseReady } from "../test-helpers";
import { FastifyInstance } from "fastify";

describe("Social Media API — Glossary / Translate", () => {
  let app: FastifyInstance;
  let token: string;
  let dbReady = false;

  beforeAll(async () => {
    app = await buildTestApp();
    dbReady = await isDatabaseReady(app);
    if (dbReady) {
      token = await getAuthToken(app);
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/v1/glossary without auth returns 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/glossary" });
    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady)("GET /api/v1/glossary returns entries with total", async () => {
    const res = await authInject(app, token, "GET", "/api/v1/glossary");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.glossary)).toBe(true);
    expect(typeof body.total).toBe("number");
  });

  it.skipIf(!dbReady)("POST /api/v1/glossary creates a glossary entry", async () => {
    const res = await authInject(app, token, "POST", "/api/v1/glossary", {
      sourceLang: "en",
      targetLang: "hi",
      sourceTerm: "cyberbullying_" + Date.now(),
      targetTerm: "साइबरबुलिंग",
      domain: "test",
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.entry).toBeDefined();
    expect(body.entry.source_lang).toBe("en");
    expect(body.entry.target_lang).toBe("hi");
    expect(body.entry.term_id).toBeDefined();
  });
});
