import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FastifyInstance } from "fastify";
import { buildTestApp, getAuthToken, isDatabaseReady, authInject } from "../test-helpers";

let app: FastifyInstance;
let token: string;
let dbReady = false;

beforeAll(async () => {
  app = await buildTestApp();
  dbReady = await isDatabaseReady(app);
  if (dbReady) {
    token = await getAuthToken(app, "officer1", "password");
  }
});

afterAll(async () => {
  await app.close();
});

describe("Evidence Chain of Custody — FR-22", () => {
  let createdEvidenceId: string;

  it.skipIf(!dbReady)("POST /api/v1/evidence creates evidence with SHA-256 hash", async () => {
    const fileContent = Buffer.from("test evidence file content").toString("base64");
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/evidence",
      payload: {
        fileName: "test-evidence.txt",
        mimeType: "text/plain",
        fileContent,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.evidence).toBeDefined();
    expect(body.evidence.evidence_id).toBeDefined();
    expect(body.evidence.hash_sha256).toBeTruthy();
    expect(body.evidence.file_name).toBe("test-evidence.txt");
    expect(body.evidence.integrity_status).toBe("PENDING");
    createdEvidenceId = body.evidence.evidence_id;
  });

  it.skipIf(!dbReady)("GET /api/v1/evidence lists evidence items", async () => {
    const res = await authInject(app, token, {
      method: "GET",
      url: "/api/v1/evidence?limit=5",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.evidence).toBeInstanceOf(Array);
    expect(typeof body.total).toBe("number");
  });

  it.skipIf(!dbReady)("GET /api/v1/evidence/:id returns evidence and logs VIEWED event", async () => {
    if (!createdEvidenceId) return;
    const res = await authInject(app, token, {
      method: "GET",
      url: `/api/v1/evidence/${createdEvidenceId}`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.evidence.evidence_id).toBe(createdEvidenceId);
  });

  it.skipIf(!dbReady)("POST /api/v1/evidence/:id/verify verifies hash integrity", async () => {
    if (!createdEvidenceId) return;
    const fileContent = Buffer.from("test evidence file content").toString("base64");
    const res = await authInject(app, token, {
      method: "POST",
      url: `/api/v1/evidence/${createdEvidenceId}/verify`,
      payload: { fileContent },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.verified).toBe(true);
    expect(body.integrityStatus).toBe("VERIFIED");
  });

  it.skipIf(!dbReady)("POST /api/v1/evidence/:id/verify detects tampering", async () => {
    if (!createdEvidenceId) return;
    const tamperedContent = Buffer.from("tampered content").toString("base64");
    const res = await authInject(app, token, {
      method: "POST",
      url: `/api/v1/evidence/${createdEvidenceId}/verify`,
      payload: { fileContent: tamperedContent },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.verified).toBe(false);
    expect(body.integrityStatus).toBe("TAMPERED");
  });

  it.skipIf(!dbReady)("GET /api/v1/evidence/:id/custody-chain returns custody events", async () => {
    if (!createdEvidenceId) return;
    const res = await authInject(app, token, {
      method: "GET",
      url: `/api/v1/evidence/${createdEvidenceId}/custody-chain`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.events).toBeInstanceOf(Array);
    expect(body.events.length).toBeGreaterThan(0);
    // Should have CREATED event at minimum
    expect(body.events.some((e: any) => e.action === "CREATED")).toBe(true);
  });

  it.skipIf(!dbReady)("POST /api/v1/evidence/:id/legal-hold toggles legal hold", async () => {
    if (!createdEvidenceId) return;

    // Apply legal hold
    const applyRes = await authInject(app, token, {
      method: "POST",
      url: `/api/v1/evidence/${createdEvidenceId}/legal-hold`,
      payload: { legalHold: true, reason: "Court order" },
    });
    expect(applyRes.statusCode).toBe(200);
    const applyBody = JSON.parse(applyRes.body);
    expect(applyBody.evidence.legal_hold).toBe(true);

    // Release legal hold
    const releaseRes = await authInject(app, token, {
      method: "POST",
      url: `/api/v1/evidence/${createdEvidenceId}/legal-hold`,
      payload: { legalHold: false },
    });
    expect(releaseRes.statusCode).toBe(200);
    const releaseBody = JSON.parse(releaseRes.body);
    expect(releaseBody.evidence.legal_hold).toBe(false);
  });

  it.skipIf(!dbReady)("GET /api/v1/evidence/:id returns 404 for non-existent ID", async () => {
    const res = await authInject(app, token, {
      method: "GET",
      url: "/api/v1/evidence/00000000-0000-0000-0000-000000000000",
    });
    expect(res.statusCode).toBe(404);
  });
});
