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

describe("Unocross Drafts — FR-07 AC-03/04/05", () => {
  let templateId: string;
  let draftId: string;

  it.skipIf(!dbReady)("creates a template for draft generation", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/unocross/templates",
      payload: {
        templateName: "Test Hawala Template",
        templateType: "HAWALA",
        queryTemplate: "SELECT * FROM financial_transaction WHERE subject_id = :subjectId",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.template.template_id).toBeDefined();
    templateId = body.template.template_id;
  });

  it.skipIf(!dbReady)("POST /api/v1/unocross/drafts creates draft from template", async () => {
    if (!templateId) return;

    // Use a dummy subject ID — the endpoint handles missing subjects gracefully
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/unocross/drafts",
      payload: {
        templateId,
        subjectIds: ["00000000-0000-0000-0000-000000000001"],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.draft).toBeDefined();
    expect(body.draft.state_id).toBe("DRAFT");
    expect(body.draft.template_id).toBe(templateId);
    draftId = body.draft.draft_id;
  });

  it.skipIf(!dbReady)("GET /api/v1/unocross/drafts lists drafts", async () => {
    const res = await authInject(app, token, {
      method: "GET",
      url: "/api/v1/unocross/drafts?limit=5",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.drafts).toBeInstanceOf(Array);
    expect(typeof body.total).toBe("number");
  });

  it.skipIf(!dbReady)("POST /api/v1/unocross/drafts/:id/submit transitions to PENDING_APPROVAL", async () => {
    if (!draftId) return;
    const res = await authInject(app, token, {
      method: "POST",
      url: `/api/v1/unocross/drafts/${draftId}/submit`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.newState).toBe("PENDING_APPROVAL");
  });

  it.skipIf(!dbReady)("POST /api/v1/unocross/drafts/:id/submit rejects non-DRAFT", async () => {
    if (!draftId) return;
    // Already in PENDING_APPROVAL, cannot submit again
    const res = await authInject(app, token, {
      method: "POST",
      url: `/api/v1/unocross/drafts/${draftId}/submit`,
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("INVALID_STATE");
  });

  it.skipIf(!dbReady)("POST /api/v1/unocross/drafts/:id/approve blocks self-approval", async () => {
    if (!draftId) return;
    // officer1 created the draft, so they can't approve their own
    const res = await authInject(app, token, {
      method: "POST",
      url: `/api/v1/unocross/drafts/${draftId}/approve`,
      payload: { approved: true },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("SELF_APPROVAL_DENIED");
  });

  it.skipIf(!dbReady)("GET /api/v1/unocross/drafts/:id/pdf generates PDF", async () => {
    if (!draftId) return;
    const res = await authInject(app, token, {
      method: "GET",
      url: `/api/v1/unocross/drafts/${draftId}/pdf`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    expect(res.headers["content-disposition"]).toContain("unocross-draft");
  });

  it.skipIf(!dbReady)("POST /api/v1/unocross/drafts returns 404 for invalid template", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/unocross/drafts",
      payload: {
        templateId: "00000000-0000-0000-0000-000000000000",
        subjectIds: ["00000000-0000-0000-0000-000000000001"],
      },
    });

    expect(res.statusCode).toBe(404);
  });

  it.skipIf(!dbReady)("GET /api/v1/unocross/drafts filters by state", async () => {
    const res = await authInject(app, token, {
      method: "GET",
      url: "/api/v1/unocross/drafts?state_id=PENDING_APPROVAL",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.drafts).toBeInstanceOf(Array);
    for (const d of body.drafts) {
      expect(d.state_id).toBe("PENDING_APPROVAL");
    }
  });
});
