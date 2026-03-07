import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  buildTestApp,
  getAuthToken,
  authInject,
  SEED_USERS,
  NON_EXISTENT_UUID,
} from "../test-helpers";

let app: any;
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
/*  Extraction Detail — FR-06                                          */
/* ------------------------------------------------------------------ */

describe("Extraction — POST /api/v1/evidence/:id/extraction", () => {
  let caseId: string;
  let evidenceId: string;

  beforeAll(async () => {
    if (!dbReady) return;
    // Create a case and evidence for extraction tests
    const caseRes = await authInject(app, token, "POST", "/api/v1/cases", {
      title: "Extraction Detail Test Case",
    });
    caseId = JSON.parse(caseRes.payload).case?.case_id;
    if (!caseId) return;

    const evRes = await authInject(
      app,
      token,
      "POST",
      `/api/v1/cases/${caseId}/evidence`,
      { sourceType: "CHAT_LOG", description: "Extraction test evidence" },
    );
    evidenceId = JSON.parse(evRes.payload).evidence?.evidence_id;
  });

  it("stores extraction detail on evidence", async () => {
    if (!dbReady || !evidenceId) return;

    const extractionDetail = {
      names: ["Ravi Kumar", "Sunita Devi"],
      dates: ["2025-12-15", "2026-01-03"],
      locations: ["Hyderabad", "Secunderabad"],
      phoneNumbers: ["+91-9876543210"],
    };

    const res = await authInject(
      app,
      token,
      "POST",
      `/api/v1/evidence/${evidenceId}/extraction`,
      { extractionDetail, language: "en" },
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.evidence).toBeDefined();
    expect(body.evidence.evidence_id).toBe(evidenceId);
    expect(body.evidence.extraction_detail).toBeDefined();
    expect(body.evidence.extraction_language).toBe("en");
  });

  it("supports Telugu language parameter", async () => {
    if (!dbReady || !evidenceId) return;

    const extractionDetail = {
      names: ["రవి కుమార్"],
      locations: ["హైదరాబాద్"],
    };

    const res = await authInject(
      app,
      token,
      "POST",
      `/api/v1/evidence/${evidenceId}/extraction`,
      { extractionDetail, language: "te" },
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.evidence).toBeDefined();
    expect(body.evidence.extraction_language).toBe("te");
  });

  it("defaults to English when no language is specified", async () => {
    if (!dbReady || !evidenceId) return;

    const res = await authInject(
      app,
      token,
      "POST",
      `/api/v1/evidence/${evidenceId}/extraction`,
      { extractionDetail: { names: ["Test Person"] } },
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.evidence.extraction_language).toBe("en");
  });

  it("returns 404 for non-existent evidence", async () => {
    if (!dbReady) return;

    const res = await authInject(
      app,
      token,
      "POST",
      `/api/v1/evidence/${NON_EXISTENT_UUID}/extraction`,
      { extractionDetail: { names: ["Test"] } },
    );
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("EVIDENCE_NOT_FOUND");
  });

  it("persists extraction detail visible in GET endpoint", async () => {
    if (!dbReady || !evidenceId) return;

    // Store extraction detail
    const extractionDetail = {
      names: ["Verification Person"],
      phoneNumbers: ["+91-1234567890"],
    };
    await authInject(
      app,
      token,
      "POST",
      `/api/v1/evidence/${evidenceId}/extraction`,
      { extractionDetail, language: "hi" },
    );

    // Retrieve and verify
    const getRes = await authInject(
      app,
      token,
      "GET",
      `/api/v1/evidence/${evidenceId}`,
    );
    expect(getRes.statusCode).toBe(200);
    const body = JSON.parse(getRes.payload);
    expect(body.evidence.extraction_detail).toBeDefined();
    expect(body.evidence.extraction_language).toBe("hi");
  });

  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/evidence/${NON_EXISTENT_UUID}/extraction`,
      payload: { extractionDetail: { names: ["Test"] } },
    });
    expect(res.statusCode).toBe(401);
  });
});
