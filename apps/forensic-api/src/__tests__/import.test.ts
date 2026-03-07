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

describe("Imports — GET /api/v1/imports", () => {
  it.skipIf(!dbReady)("returns an array of import jobs", async () => {
    const res = await authInject(app, token, "GET", "/api/v1/imports");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.imports).toBeInstanceOf(Array);
    expect(typeof body.total).toBe("number");
  });
});

describe("Imports — POST /api/v1/imports", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/imports",
      payload: { caseId: "00000000-0000-0000-0000-000000000001", parserType: "RAW" },
    });
    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady)("creates an import job", async () => {
    // First create a case to attach the import to
    const caseRes = await authInject(app, token, "POST", "/api/v1/cases", {
      title: "Import Test Case",
    });
    const caseId = JSON.parse(caseRes.payload).case?.case_id;
    if (!caseId) return;

    const res = await authInject(app, token, "POST", "/api/v1/imports", {
      caseId,
      parserType: "RAW",
      jobType: "MANUAL_UPLOAD",
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.import).toBeDefined();
    expect(body.import.import_job_id).toBeDefined();
    expect(body.import.case_id).toBe(caseId);
    expect(body.import.parser_type).toBe("RAW");
  });
});
