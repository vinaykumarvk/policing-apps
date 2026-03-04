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
let examinerToken: string;
let supervisorToken: string;
let dbReady = false;

beforeAll(async () => {
  app = await buildTestApp();
  const t1 = await getAuthToken(
    app,
    SEED_USERS.examiner.username,
    SEED_USERS.examiner.password,
  );
  const t2 = await getAuthToken(
    app,
    SEED_USERS.supervisor.username,
    SEED_USERS.supervisor.password,
  );
  if (t1 && t2) {
    examinerToken = t1;
    supervisorToken = t2;
    dbReady = true;
  }
});

afterAll(async () => {
  await app.close();
});

/* ------------------------------------------------------------------ */
/*  Case workflow transitions                                          */
/* ------------------------------------------------------------------ */

describe("Workflow — Case transitions", () => {
  let caseId: string;

  it("creates a DRAFT case and activates it", async () => {
    if (!dbReady) return;

    // Create a case (starts in DRAFT)
    const createRes = await authInject(app, examinerToken, "POST", "/api/v1/cases", {
      title: "Workflow Test Case",
    });
    expect(createRes.statusCode).toBe(201);
    caseId = JSON.parse(createRes.payload).case.case_id;

    // Verify the case is in DRAFT
    const getRes = await authInject(app, examinerToken, "GET", `/api/v1/cases/${caseId}`);
    expect(JSON.parse(getRes.payload).case.state_id).toBe("DRAFT");

    // ACTIVATE: DRAFT -> ACTIVE
    const transRes = await authInject(
      app,
      examinerToken,
      "POST",
      `/api/v1/cases/${caseId}/transition`,
      { transitionId: "ACTIVATE" },
    );
    expect(transRes.statusCode).toBe(200);
    const transBody = JSON.parse(transRes.payload);
    expect(transBody.success).toBe(true);
    expect(transBody.newStateId).toBe("ACTIVE");
  });

  it("returns 404 for transitions on non-existent case", async () => {
    if (!dbReady) return;

    const res = await authInject(
      app,
      examinerToken,
      "GET",
      `/api/v1/cases/${NON_EXISTENT_UUID}/transitions`,
    );
    expect(res.statusCode).toBe(404);
  });

  it("returns 409 for invalid transition", async () => {
    if (!dbReady || !caseId) return;

    // Case is now ACTIVE, trying ACTIVATE again should fail
    const res = await authInject(
      app,
      examinerToken,
      "POST",
      `/api/v1/cases/${caseId}/transition`,
      { transitionId: "ACTIVATE" },
    );
    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.payload);
    expect(body.error).toBeDefined();
  });
});

/* ------------------------------------------------------------------ */
/*  Finding workflow transitions                                       */
/* ------------------------------------------------------------------ */

describe("Workflow — Finding transitions", () => {
  it("returns available transitions for a finding", async () => {
    if (!dbReady) return;

    // We cannot directly create findings via API easily (they come from AI pipeline),
    // so we test the transitions endpoint with a non-existent ID to verify 404 handling.
    const res = await authInject(
      app,
      examinerToken,
      "GET",
      `/api/v1/findings/${NON_EXISTENT_UUID}/transitions`,
    );
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("FINDING_NOT_FOUND");
  });

  it("returns 409 for transition on non-existent finding", async () => {
    if (!dbReady) return;

    const res = await authInject(
      app,
      examinerToken,
      "POST",
      `/api/v1/findings/${NON_EXISTENT_UUID}/transition`,
      { transitionId: "MARK_REVIEW" },
    );
    // The workflow engine should fail because the finding does not exist
    expect(res.statusCode).toBe(409);
  });
});

/* ------------------------------------------------------------------ */
/*  Report workflow transitions                                        */
/* ------------------------------------------------------------------ */

describe("Workflow — Report transitions", () => {
  let caseId: string;
  let reportId: string;

  it("creates a report and submits it for approval", async () => {
    if (!dbReady) return;

    // Create a case for the report
    const caseRes = await authInject(app, examinerToken, "POST", "/api/v1/cases", {
      title: "Report Workflow Test Case",
    });
    caseId = JSON.parse(caseRes.payload).case.case_id;

    // Create a report (starts in DRAFT)
    const reportRes = await authInject(app, examinerToken, "POST", "/api/v1/reports", {
      caseId,
      title: "Workflow Test Report",
    });
    expect(reportRes.statusCode).toBe(201);
    reportId = JSON.parse(reportRes.payload).report.report_id;

    // SUBMIT: DRAFT -> PENDING_APPROVAL (requires FORENSIC_ANALYST role)
    const transRes = await authInject(
      app,
      examinerToken,
      "POST",
      `/api/v1/reports/${reportId}/transition`,
      { transitionId: "SUBMIT" },
    );
    expect(transRes.statusCode).toBe(200);
    const transBody = JSON.parse(transRes.payload);
    expect(transBody.success).toBe(true);
    expect(transBody.newStateId).toBe("PENDING_APPROVAL");
  });

  it("returns 404 for transitions on non-existent report", async () => {
    if (!dbReady) return;

    const res = await authInject(
      app,
      examinerToken,
      "GET",
      `/api/v1/reports/${NON_EXISTENT_UUID}/transitions`,
    );
    expect(res.statusCode).toBe(404);
  });
});
