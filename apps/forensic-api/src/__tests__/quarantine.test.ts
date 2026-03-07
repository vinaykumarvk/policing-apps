import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  buildTestApp,
  getAuthToken,
  authInject,
  SEED_USERS,
  NON_EXISTENT_UUID,
} from "../test-helpers";

let app: any;
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
/*  Quarantine Flow — FR-02                                            */
/* ------------------------------------------------------------------ */

describe("Quarantine — POST /api/v1/evidence/:id/quarantine", () => {
  let caseId: string;
  let evidenceId: string;

  beforeAll(async () => {
    if (!dbReady) return;
    // Create a case and evidence item for quarantine tests
    const caseRes = await authInject(app, examinerToken, "POST", "/api/v1/cases", {
      title: "Quarantine Test Case",
    });
    caseId = JSON.parse(caseRes.payload).case?.case_id;
    if (!caseId) return;

    const evRes = await authInject(
      app,
      examinerToken,
      "POST",
      `/api/v1/cases/${caseId}/evidence`,
      { sourceType: "DISK_IMAGE", description: "Quarantine test evidence" },
    );
    evidenceId = JSON.parse(evRes.payload).evidence?.evidence_id;
  });

  it("sets quarantine status on evidence", async () => {
    if (!dbReady || !evidenceId) return;

    const res = await authInject(
      app,
      examinerToken,
      "POST",
      `/api/v1/evidence/${evidenceId}/quarantine`,
      { reason: "Suspected malware detected" },
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.evidence).toBeDefined();
    expect(body.evidence.evidence_id).toBe(evidenceId);
    expect(body.evidence.quarantine_status).toBe("QUARANTINED");
    expect(body.evidence.quarantine_reason).toBe("Suspected malware detected");
  });

  it("returns 409 when evidence is already quarantined", async () => {
    if (!dbReady || !evidenceId) return;

    const res = await authInject(
      app,
      examinerToken,
      "POST",
      `/api/v1/evidence/${evidenceId}/quarantine`,
      { reason: "Double quarantine attempt" },
    );
    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("ALREADY_QUARANTINED");
  });

  it("returns 404 for non-existent evidence", async () => {
    if (!dbReady) return;

    const res = await authInject(
      app,
      examinerToken,
      "POST",
      `/api/v1/evidence/${NON_EXISTENT_UUID}/quarantine`,
      { reason: "Test reason" },
    );
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("EVIDENCE_NOT_FOUND");
  });

  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/evidence/${NON_EXISTENT_UUID}/quarantine`,
      payload: { reason: "Test" },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("Quarantine Approve — POST /api/v1/evidence/:id/quarantine/approve", () => {
  let caseId: string;
  let evidenceId: string;

  beforeAll(async () => {
    if (!dbReady) return;
    // Create a case, evidence, and quarantine it
    const caseRes = await authInject(app, examinerToken, "POST", "/api/v1/cases", {
      title: "Quarantine Approval Test Case",
    });
    caseId = JSON.parse(caseRes.payload).case?.case_id;
    if (!caseId) return;

    const evRes = await authInject(
      app,
      examinerToken,
      "POST",
      `/api/v1/cases/${caseId}/evidence`,
      { sourceType: "MOBILE_DUMP", description: "Approval test evidence" },
    );
    evidenceId = JSON.parse(evRes.payload).evidence?.evidence_id;
    if (!evidenceId) return;

    // Quarantine the evidence
    await authInject(
      app,
      examinerToken,
      "POST",
      `/api/v1/evidence/${evidenceId}/quarantine`,
      { reason: "Needs supervisor review" },
    );
  });

  it("supervisor approves quarantined evidence", async () => {
    if (!dbReady || !evidenceId) return;

    const res = await authInject(
      app,
      supervisorToken,
      "POST",
      `/api/v1/evidence/${evidenceId}/quarantine/approve`,
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.evidence).toBeDefined();
    expect(body.evidence.evidence_id).toBe(evidenceId);
    expect(body.evidence.quarantine_status).toBe("APPROVED");
    expect(body.evidence.quarantine_approved_by).toBeDefined();
  });

  it("returns 409 when evidence is not in QUARANTINED state", async () => {
    if (!dbReady || !evidenceId) return;

    // Evidence is now APPROVED, trying to approve again should fail
    const res = await authInject(
      app,
      supervisorToken,
      "POST",
      `/api/v1/evidence/${evidenceId}/quarantine/approve`,
    );
    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("INVALID_STATE");
  });

  it("returns 404 for non-existent evidence", async () => {
    if (!dbReady) return;

    const res = await authInject(
      app,
      supervisorToken,
      "POST",
      `/api/v1/evidence/${NON_EXISTENT_UUID}/quarantine/approve`,
    );
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("EVIDENCE_NOT_FOUND");
  });

  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/evidence/${NON_EXISTENT_UUID}/quarantine/approve`,
    });
    expect(res.statusCode).toBe(401);
  });
});
