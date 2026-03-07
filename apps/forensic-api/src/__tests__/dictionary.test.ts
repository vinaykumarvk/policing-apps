import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, getAuthToken, authInject, isDatabaseReady } from "../test-helpers";
import { FastifyInstance } from "fastify";

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

describe("Dictionary — GET /api/v1/dictionaries", () => {
  it.skipIf(!dbReady)("returns an array of keyword dictionaries", async () => {
    const res = await authInject(app, token, "GET", "/api/v1/dictionaries");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.dictionaries).toBeInstanceOf(Array);
    expect(typeof body.total).toBe("number");
  });

  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/dictionaries",
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("Dictionary — POST /api/v1/dictionaries", () => {
  it.skipIf(!dbReady)("creates a keyword dictionary entry", async () => {
    const res = await authInject(app, token, "POST", "/api/v1/dictionaries", {
      dictionaryName: "Test Drug Terms",
      category: "DRUGS",
      keywords: ["substance", "narcotic", "controlled"],
      description: "Integration test dictionary",
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.dictionary).toBeDefined();
    expect(body.dictionary.dictionary_id).toBeDefined();
    expect(body.dictionary.dictionary_name).toBe("Test Drug Terms");
    expect(body.dictionary.category).toBe("DRUGS");
  });
});
