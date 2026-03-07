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
/*  Drug Classify — POST /api/v1/drug-classify/:entityType/:entityId   */
/* ------------------------------------------------------------------ */

describe("Drug Classify — POST /api/v1/drug-classify/:entityType/:entityId", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/drug-classify/forensic_case/${NON_EXISTENT_UUID}`,
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 404 for non-existent entity", async () => {
    if (!dbReady) return;

    const res = await authInject(
      app,
      token,
      "POST",
      `/api/v1/drug-classify/forensic_case/${NON_EXISTENT_UUID}`,
    );
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("NOT_FOUND");
  });

  it("returns 400 for unsupported entity type", async () => {
    if (!dbReady) return;

    const res = await authInject(
      app,
      token,
      "POST",
      `/api/v1/drug-classify/unknown_type/${NON_EXISTENT_UUID}`,
    );
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("UNKNOWN_ENTITY_TYPE");
  });

  it("classifies a forensic case for drug role", async () => {
    if (!dbReady) return;

    // Create a case with drug-related description
    const caseRes = await authInject(app, token, "POST", "/api/v1/cases", {
      title: "Drug Classification Test Case",
      description: "Suspect involved in trafficking methamphetamine and heroin distribution network",
    });
    const caseId = JSON.parse(caseRes.payload).case?.case_id;
    if (!caseId) return;

    const res = await authInject(
      app,
      token,
      "POST",
      `/api/v1/drug-classify/forensic_case/${caseId}`,
    );
    expect(res.statusCode).toBe(201);
  });
});

/* ------------------------------------------------------------------ */
/*  Drug Classify — GET /api/v1/drug-classify/:entityType/:entityId    */
/* ------------------------------------------------------------------ */

describe("Drug Classify — GET /api/v1/drug-classify/:entityType/:entityId", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/drug-classify/forensic_case/${NON_EXISTENT_UUID}`,
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns classifications array for a valid entity", async () => {
    if (!dbReady) return;

    const res = await authInject(
      app,
      token,
      "GET",
      `/api/v1/drug-classify/forensic_case/${NON_EXISTENT_UUID}`,
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.classifications).toBeInstanceOf(Array);
  });
});

/* ------------------------------------------------------------------ */
/*  Drug Classify — PATCH /api/v1/drug-classify/:id/review             */
/* ------------------------------------------------------------------ */

describe("Drug Classify — PATCH /api/v1/drug-classify/:classificationId/review", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/drug-classify/${NON_EXISTENT_UUID}/review`,
      payload: { reviewStatus: "CONFIRMED" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 404 for non-existent classification", async () => {
    if (!dbReady) return;

    const res = await authInject(
      app,
      token,
      "PATCH",
      `/api/v1/drug-classify/${NON_EXISTENT_UUID}/review`,
      { reviewStatus: "CONFIRMED" },
    );
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("NOT_FOUND");
  });
});

/* ------------------------------------------------------------------ */
/*  Drug Classify — GET /api/v1/drug-classify/distribution             */
/* ------------------------------------------------------------------ */

describe("Drug Classify — GET /api/v1/drug-classify/distribution", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/drug-classify/distribution",
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns role distribution data", async () => {
    if (!dbReady) return;

    const res = await authInject(
      app,
      token,
      "GET",
      "/api/v1/drug-classify/distribution",
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.distribution).toBeDefined();
  });
});

/* ------------------------------------------------------------------ */
/*  Drug Classify — GET /api/v1/drug-classify/recidivists              */
/* ------------------------------------------------------------------ */

describe("Drug Classify — GET /api/v1/drug-classify/recidivists", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/drug-classify/recidivists",
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns recidivists data", async () => {
    if (!dbReady) return;

    const res = await authInject(
      app,
      token,
      "GET",
      "/api/v1/drug-classify/recidivists",
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.recidivists).toBeDefined();
  });
});
