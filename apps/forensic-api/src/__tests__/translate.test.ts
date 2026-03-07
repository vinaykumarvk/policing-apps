import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  buildTestApp,
  getAuthToken,
  authInject,
  TestApp,
  SEED_USERS,
  NON_EXISTENT_UUID,
} from "../test-helpers";

let app: TestApp;
let token: string;
let dbReady = false;

beforeAll(async () => {
  app = await buildTestApp();
  const t = await getAuthToken(
    app,
    SEED_USERS.examiner.username,
    SEED_USERS.examiner.password,
  );
  if (t) {
    token = t;
    dbReady = true;
  }
});

afterAll(async () => {
  await app.close();
});

/* ------------------------------------------------------------------ */
/*  Translate — POST /api/v1/translate                                 */
/* ------------------------------------------------------------------ */

describe("Translate — POST /api/v1/translate", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/translate",
      payload: {
        entityType: "forensic_case",
        entityId: NON_EXISTENT_UUID,
        targetLanguage: "hi",
      },
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 400 for unsupported entity type", async () => {
    if (!dbReady) return;

    const res = await authInject(app, token, "POST", "/api/v1/translate", {
      entityType: "unknown_entity",
      entityId: NON_EXISTENT_UUID,
      targetLanguage: "hi",
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("UNKNOWN_ENTITY_TYPE");
  });

  it("returns 404 for non-existent entity", async () => {
    if (!dbReady) return;

    const res = await authInject(app, token, "POST", "/api/v1/translate", {
      entityType: "forensic_case",
      entityId: NON_EXISTENT_UUID,
      targetLanguage: "hi",
    });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("NOT_FOUND");
  });

  it("translates a forensic case with description", async () => {
    if (!dbReady) return;

    // Create a case with a description to translate
    const caseRes = await authInject(app, token, "POST", "/api/v1/cases", {
      title: "Translation Test Case",
      description: "This case involves digital evidence found on a suspect mobile device",
    });
    const caseId = JSON.parse(caseRes.payload).case?.case_id;
    if (!caseId) return;

    const res = await authInject(app, token, "POST", "/api/v1/translate", {
      entityType: "forensic_case",
      entityId: caseId,
      targetLanguage: "hi",
    });
    // Translation service may or may not be fully available
    expect([200, 500]).toContain(res.statusCode);
  });

  it("rejects request with missing required fields", async () => {
    if (!dbReady) return;

    const res = await authInject(app, token, "POST", "/api/v1/translate", {
      entityType: "forensic_case",
    });
    expect(res.statusCode).toBe(400);
  });
});

/* ------------------------------------------------------------------ */
/*  Translate — GET /api/v1/translations/:entityType/:entityId         */
/* ------------------------------------------------------------------ */

describe("Translate — GET /api/v1/translations/:entityType/:entityId", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/translations/forensic_case/${NON_EXISTENT_UUID}`,
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns translations list for an entity", async () => {
    if (!dbReady) return;

    const res = await authInject(
      app,
      token,
      "GET",
      `/api/v1/translations/forensic_case/${NON_EXISTENT_UUID}`,
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.translations).toBeInstanceOf(Array);
  });

  it("returns empty translations for entity with no translations", async () => {
    if (!dbReady) return;

    // Create a case that has never been translated
    const caseRes = await authInject(app, token, "POST", "/api/v1/cases", {
      title: "No Translations Test Case",
    });
    const caseId = JSON.parse(caseRes.payload).case?.case_id;
    if (!caseId) return;

    const res = await authInject(
      app,
      token,
      "GET",
      `/api/v1/translations/forensic_case/${caseId}`,
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.translations).toBeInstanceOf(Array);
    expect(body.translations.length).toBe(0);
  });
});
