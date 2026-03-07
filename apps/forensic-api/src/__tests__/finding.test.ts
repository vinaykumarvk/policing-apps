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
/*  Findings — GET /api/v1/cases/:caseId/findings                     */
/* ------------------------------------------------------------------ */

describe("Findings — GET /api/v1/cases/:caseId/findings", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/cases/${NON_EXISTENT_UUID}/findings`,
    });
    expect(res.statusCode).toBe(401);
  });

  it("lists findings for a case", async () => {
    if (!dbReady) return;

    // Create a case
    const caseRes = await authInject(app, token, "POST", "/api/v1/cases", {
      title: "Findings List Test Case",
    });
    const caseId = JSON.parse(caseRes.payload).case?.case_id;
    if (!caseId) return;

    const res = await authInject(
      app,
      token,
      "GET",
      `/api/v1/cases/${caseId}/findings`,
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.findings).toBeInstanceOf(Array);
    expect(typeof body.total).toBe("number");
  });

  it("supports pagination with limit and offset", async () => {
    if (!dbReady) return;

    const caseRes = await authInject(app, token, "POST", "/api/v1/cases", {
      title: "Findings Pagination Test Case",
    });
    const caseId = JSON.parse(caseRes.payload).case?.case_id;
    if (!caseId) return;

    const res = await authInject(
      app,
      token,
      "GET",
      `/api/v1/cases/${caseId}/findings?limit=10&offset=0`,
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.findings).toBeInstanceOf(Array);
    expect(typeof body.total).toBe("number");
  });

  it("returns empty array for non-existent case", async () => {
    if (!dbReady) return;

    const res = await authInject(
      app,
      token,
      "GET",
      `/api/v1/cases/${NON_EXISTENT_UUID}/findings`,
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.findings).toBeInstanceOf(Array);
    expect(body.findings.length).toBe(0);
    expect(body.total).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/*  Findings — GET /api/v1/findings/:id/transitions                    */
/* ------------------------------------------------------------------ */

describe("Findings — GET /api/v1/findings/:id/transitions", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/findings/${NON_EXISTENT_UUID}/transitions`,
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 404 for non-existent finding", async () => {
    if (!dbReady) return;

    const res = await authInject(
      app,
      token,
      "GET",
      `/api/v1/findings/${NON_EXISTENT_UUID}/transitions`,
    );
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("FINDING_NOT_FOUND");
  });
});

/* ------------------------------------------------------------------ */
/*  Findings — POST /api/v1/findings/:id/transition                    */
/* ------------------------------------------------------------------ */

describe("Findings — POST /api/v1/findings/:id/transition", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/findings/${NON_EXISTENT_UUID}/transition`,
      payload: { transitionId: "REVIEW" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("rejects transition with missing transitionId", async () => {
    if (!dbReady) return;

    const res = await authInject(
      app,
      token,
      "POST",
      `/api/v1/findings/${NON_EXISTENT_UUID}/transition`,
      {},
    );
    expect(res.statusCode).toBe(400);
  });
});
