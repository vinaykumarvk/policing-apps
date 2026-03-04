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
/*  Cases                                                              */
/* ------------------------------------------------------------------ */

describe("CRUD — Cases", () => {
  let createdCaseId: string;

  it("POST /api/v1/cases creates a new case", async () => {
    if (!dbReady) return;

    const res = await authInject(app, token, "POST", "/api/v1/cases", {
      title: "Integration Test Case",
      description: "Created by integration tests",
      caseType: "DIGITAL_FORENSICS",
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.case).toBeDefined();
    expect(body.case.case_id).toBeDefined();
    expect(body.case.title).toBe("Integration Test Case");
    expect(body.case.state_id).toBe("DRAFT");
    expect(body.case.case_number).toMatch(/^EF-CASE-/);
    createdCaseId = body.case.case_id;
  });

  it("GET /api/v1/cases lists cases", async () => {
    if (!dbReady) return;

    const res = await authInject(app, token, "GET", "/api/v1/cases");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.cases).toBeInstanceOf(Array);
    expect(typeof body.total).toBe("number");
  });

  it("GET /api/v1/cases/:id returns a single case", async () => {
    if (!dbReady || !createdCaseId) return;

    const res = await authInject(
      app,
      token,
      "GET",
      `/api/v1/cases/${createdCaseId}`,
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.case.case_id).toBe(createdCaseId);
    expect(body.case.title).toBe("Integration Test Case");
  });

  it("GET /api/v1/cases/:id returns 404 for non-existent case", async () => {
    if (!dbReady) return;

    const res = await authInject(
      app,
      token,
      "GET",
      `/api/v1/cases/${NON_EXISTENT_UUID}`,
    );
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("CASE_NOT_FOUND");
  });

  it("GET /api/v1/cases/:id/transitions returns available transitions", async () => {
    if (!dbReady || !createdCaseId) return;

    const res = await authInject(
      app,
      token,
      "GET",
      `/api/v1/cases/${createdCaseId}/transitions`,
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.transitions).toBeInstanceOf(Array);
    // DRAFT case should have at least the ACTIVATE transition
    const ids = body.transitions.map((t: { transitionId: string }) => t.transitionId);
    expect(ids).toContain("ACTIVATE");
  });
});

/* ------------------------------------------------------------------ */
/*  Evidence (case sub-resource)                                       */
/* ------------------------------------------------------------------ */

describe("CRUD — Evidence", () => {
  let caseId: string;
  let evidenceId: string;

  beforeAll(async () => {
    if (!dbReady) return;
    // Create a case to attach evidence to
    const res = await authInject(app, token, "POST", "/api/v1/cases", {
      title: "Evidence Test Case",
    });
    caseId = JSON.parse(res.payload).case?.case_id;
  });

  it("POST /api/v1/cases/:id/evidence creates evidence", async () => {
    if (!dbReady || !caseId) return;

    const res = await authInject(
      app,
      token,
      "POST",
      `/api/v1/cases/${caseId}/evidence`,
      { sourceType: "DISK_IMAGE", description: "Test disk image" },
    );
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.evidence).toBeDefined();
    expect(body.evidence.evidence_id).toBeDefined();
    expect(body.evidence.case_id).toBe(caseId);
    expect(body.evidence.evidence_ref).toMatch(/^EF-EVD-/);
    evidenceId = body.evidence.evidence_id;
  });

  it("GET /api/v1/evidence/:id returns evidence detail", async () => {
    if (!dbReady || !evidenceId) return;

    const res = await authInject(
      app,
      token,
      "GET",
      `/api/v1/evidence/${evidenceId}`,
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.evidence.evidence_id).toBe(evidenceId);
    expect(body.evidence.source_type).toBe("DISK_IMAGE");
  });

  it("GET /api/v1/evidence/:id returns 404 for non-existent evidence", async () => {
    if (!dbReady) return;

    const res = await authInject(
      app,
      token,
      "GET",
      `/api/v1/evidence/${NON_EXISTENT_UUID}`,
    );
    expect(res.statusCode).toBe(404);
  });
});

/* ------------------------------------------------------------------ */
/*  Findings (case sub-resource)                                       */
/* ------------------------------------------------------------------ */

describe("CRUD — Findings", () => {
  it("GET /api/v1/cases/:caseId/findings lists findings for a case", async () => {
    if (!dbReady) return;

    // Create a case first
    const caseRes = await authInject(app, token, "POST", "/api/v1/cases", {
      title: "Findings Test Case",
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
});

/* ------------------------------------------------------------------ */
/*  Reports (case sub-resource + standalone)                           */
/* ------------------------------------------------------------------ */

describe("CRUD — Reports", () => {
  let caseId: string;
  let reportId: string;

  beforeAll(async () => {
    if (!dbReady) return;
    const res = await authInject(app, token, "POST", "/api/v1/cases", {
      title: "Report Test Case",
    });
    caseId = JSON.parse(res.payload).case?.case_id;
  });

  it("POST /api/v1/reports creates a report for a case", async () => {
    if (!dbReady || !caseId) return;

    const res = await authInject(app, token, "POST", "/api/v1/reports", {
      caseId,
      title: "Test Forensic Report",
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.report).toBeDefined();
    expect(body.report.report_id).toBeDefined();
    expect(body.report.case_id).toBe(caseId);
    expect(body.report.report_ref).toMatch(/^EF-RPT-/);
    expect(body.report.state_id).toBe("DRAFT");
    reportId = body.report.report_id;
  });

  it("GET /api/v1/cases/:caseId/reports lists reports for a case", async () => {
    if (!dbReady || !caseId) return;

    const res = await authInject(
      app,
      token,
      "GET",
      `/api/v1/cases/${caseId}/reports`,
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.reports).toBeInstanceOf(Array);
    expect(typeof body.total).toBe("number");
  });

  it("GET /api/v1/reports/:id/transitions returns transitions for a report", async () => {
    if (!dbReady || !reportId) return;

    const res = await authInject(
      app,
      token,
      "GET",
      `/api/v1/reports/${reportId}/transitions`,
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.transitions).toBeInstanceOf(Array);
    // DRAFT report should have SUBMIT transition
    const ids = body.transitions.map((t: { transitionId: string }) => t.transitionId);
    expect(ids).toContain("SUBMIT");
  });
});
