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
/*  Evidence — Custody Log                                             */
/* ------------------------------------------------------------------ */

describe("Evidence — GET /api/v1/evidence/:id/custody-log", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/evidence/${NON_EXISTENT_UUID}/custody-log`,
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns custody events for evidence", async () => {
    if (!dbReady) return;

    // Create a case and evidence
    const caseRes = await authInject(app, token, "POST", "/api/v1/cases", {
      title: "Custody Log Test Case",
    });
    const caseId = JSON.parse(caseRes.payload).case?.case_id;
    if (!caseId) return;

    const evRes = await authInject(
      app,
      token,
      "POST",
      `/api/v1/cases/${caseId}/evidence`,
      { sourceType: "DISK_IMAGE", description: "Custody log test" },
    );
    const evidenceId = JSON.parse(evRes.payload).evidence?.evidence_id;
    if (!evidenceId) return;

    // Access the evidence to generate a VIEWED custody event
    await authInject(app, token, "GET", `/api/v1/evidence/${evidenceId}`);

    const res = await authInject(
      app,
      token,
      "GET",
      `/api/v1/evidence/${evidenceId}/custody-log`,
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.events).toBeInstanceOf(Array);
  });
});

/* ------------------------------------------------------------------ */
/*  Evidence — Verify Hash                                             */
/* ------------------------------------------------------------------ */

describe("Evidence — GET /api/v1/evidence/:id/verify", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/evidence/${NON_EXISTENT_UUID}/verify`,
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 404 for non-existent evidence", async () => {
    if (!dbReady) return;

    const res = await authInject(
      app,
      token,
      "GET",
      `/api/v1/evidence/${NON_EXISTENT_UUID}/verify`,
    );
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("EVIDENCE_NOT_FOUND");
  });

  it("verifies evidence with no stored hash", async () => {
    if (!dbReady) return;

    // Create evidence without file content (no hash)
    const caseRes = await authInject(app, token, "POST", "/api/v1/cases", {
      title: "Verify Hash Test Case",
    });
    const caseId = JSON.parse(caseRes.payload).case?.case_id;
    if (!caseId) return;

    const evRes = await authInject(
      app,
      token,
      "POST",
      `/api/v1/cases/${caseId}/evidence`,
      { sourceType: "DISK_IMAGE", description: "No hash evidence" },
    );
    const evidenceId = JSON.parse(evRes.payload).evidence?.evidence_id;
    if (!evidenceId) return;

    const res = await authInject(
      app,
      token,
      "GET",
      `/api/v1/evidence/${evidenceId}/verify`,
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.evidenceId).toBe(evidenceId);
    expect(body.verified).toBe(false);
    expect(body.reason).toBe("NO_HASH_STORED");
  });
});

/* ------------------------------------------------------------------ */
/*  Evidence — Package                                                 */
/* ------------------------------------------------------------------ */

describe("Evidence — POST /api/v1/evidence/:id/package", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/evidence/${NON_EXISTENT_UUID}/package`,
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 404 for non-existent evidence", async () => {
    if (!dbReady) return;

    const res = await authInject(
      app,
      token,
      "POST",
      `/api/v1/evidence/${NON_EXISTENT_UUID}/package`,
    );
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("EVIDENCE_NOT_FOUND");
  });

  it("returns 422 when evidence has no file path", async () => {
    if (!dbReady) return;

    // Create evidence without a file path
    const caseRes = await authInject(app, token, "POST", "/api/v1/cases", {
      title: "Package Test Case",
    });
    const caseId = JSON.parse(caseRes.payload).case?.case_id;
    if (!caseId) return;

    const evRes = await authInject(
      app,
      token,
      "POST",
      `/api/v1/cases/${caseId}/evidence`,
      { sourceType: "DISK_IMAGE", description: "No file path evidence" },
    );
    const evidenceId = JSON.parse(evRes.payload).evidence?.evidence_id;
    if (!evidenceId) return;

    const res = await authInject(
      app,
      token,
      "POST",
      `/api/v1/evidence/${evidenceId}/package`,
    );
    expect(res.statusCode).toBe(422);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("NO_FILE_PATH");
  });
});

/* ------------------------------------------------------------------ */
/*  Evidence — Custody Log PDF                                         */
/* ------------------------------------------------------------------ */

describe("Evidence — GET /api/v1/evidence/:id/custody-log/pdf", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/evidence/${NON_EXISTENT_UUID}/custody-log/pdf`,
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 404 for non-existent evidence", async () => {
    if (!dbReady) return;

    const res = await authInject(
      app,
      token,
      "GET",
      `/api/v1/evidence/${NON_EXISTENT_UUID}/custody-log/pdf`,
    );
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("EVIDENCE_NOT_FOUND");
  });

  it("generates a custody chain PDF for valid evidence", async () => {
    if (!dbReady) return;

    // Create a case and evidence
    const caseRes = await authInject(app, token, "POST", "/api/v1/cases", {
      title: "Custody PDF Test Case",
    });
    const caseId = JSON.parse(caseRes.payload).case?.case_id;
    if (!caseId) return;

    const evRes = await authInject(
      app,
      token,
      "POST",
      `/api/v1/cases/${caseId}/evidence`,
      { sourceType: "MOBILE_DUMP", description: "PDF test evidence" },
    );
    const evidenceId = JSON.parse(evRes.payload).evidence?.evidence_id;
    if (!evidenceId) return;

    const res = await authInject(
      app,
      token,
      "GET",
      `/api/v1/evidence/${evidenceId}/custody-log/pdf`,
    );
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.headers["content-disposition"]).toContain("attachment");
  });
});

/* ------------------------------------------------------------------ */
/*  Evidence — Dedup detection via hash                                */
/* ------------------------------------------------------------------ */

describe("Evidence — dedup detection on POST", () => {
  it("flags duplicate hash within the same case", async () => {
    if (!dbReady) return;

    // Create a case
    const caseRes = await authInject(app, token, "POST", "/api/v1/cases", {
      title: "Dedup Test Case",
    });
    const caseId = JSON.parse(caseRes.payload).case?.case_id;
    if (!caseId) return;

    const fileContent = Buffer.from("identical content for dedup test").toString("base64");

    // First upload
    const res1 = await authInject(
      app,
      token,
      "POST",
      `/api/v1/cases/${caseId}/evidence`,
      { sourceType: "DISK_IMAGE", description: "First upload", fileContent },
    );
    expect(res1.statusCode).toBe(201);
    const body1 = JSON.parse(res1.payload);
    expect(body1.evidence.dedup_status).toBe("UNIQUE");

    // Second upload with same content
    const res2 = await authInject(
      app,
      token,
      "POST",
      `/api/v1/cases/${caseId}/evidence`,
      { sourceType: "DISK_IMAGE", description: "Second upload", fileContent },
    );
    expect(res2.statusCode).toBe(201);
    const body2 = JSON.parse(res2.payload);
    expect(body2.evidence.dedup_status).toBe("DUPLICATE");
    expect(body2.warning).toBe("Duplicate hash detected for this case");
  });
});
