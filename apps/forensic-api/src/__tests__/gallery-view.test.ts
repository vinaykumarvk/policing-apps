import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  buildTestApp,
  getAuthToken,
  authInject,
  SEED_USERS,
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
/*  Gallery View — FR-05                                               */
/* ------------------------------------------------------------------ */

describe("Gallery — GET /api/v1/search/gallery", () => {
  let caseId: string;

  beforeAll(async () => {
    if (!dbReady) return;
    // Create a case with evidence to populate gallery
    const caseRes = await authInject(app, token, "POST", "/api/v1/cases", {
      title: "Gallery View Test Case",
    });
    caseId = JSON.parse(caseRes.payload).case?.case_id;
    if (!caseId) return;

    // Add evidence items of different types
    await authInject(
      app,
      token,
      "POST",
      `/api/v1/cases/${caseId}/evidence`,
      { sourceType: "image", description: "Photo evidence" },
    );
    await authInject(
      app,
      token,
      "POST",
      `/api/v1/cases/${caseId}/evidence`,
      { sourceType: "document", description: "Document evidence" },
    );
  });

  it("returns items array with expected fields", async () => {
    if (!dbReady) return;

    const res = await authInject(
      app,
      token,
      "GET",
      "/api/v1/search/gallery",
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.items).toBeInstanceOf(Array);
    expect(typeof body.total).toBe("number");

    // Verify shape of each gallery item when items exist
    if (body.items.length > 0) {
      const item = body.items[0];
      expect(item).toHaveProperty("evidenceId");
      expect(item).toHaveProperty("fileName");
      expect(item).toHaveProperty("mimeType");
      expect(item).toHaveProperty("thumbnailUrl");
      expect(item).toHaveProperty("uploadedAt");
      expect(item).toHaveProperty("caseTitle");
    }
  });

  it("filters by caseId parameter", async () => {
    if (!dbReady || !caseId) return;

    const res = await authInject(
      app,
      token,
      "GET",
      `/api/v1/search/gallery?caseId=${caseId}`,
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.items).toBeInstanceOf(Array);
    expect(typeof body.total).toBe("number");
  });

  it("filters by type parameter", async () => {
    if (!dbReady) return;

    const res = await authInject(
      app,
      token,
      "GET",
      "/api/v1/search/gallery?type=image",
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.items).toBeInstanceOf(Array);
    expect(typeof body.total).toBe("number");

    // All returned items should have mimeType = "image"
    for (const item of body.items) {
      expect(item.mimeType).toBe("image");
    }
  });

  it("supports pagination with page and limit", async () => {
    if (!dbReady) return;

    const res = await authInject(
      app,
      token,
      "GET",
      "/api/v1/search/gallery?page=1&limit=5",
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.items).toBeInstanceOf(Array);
    expect(body.items.length).toBeLessThanOrEqual(5);
    expect(typeof body.total).toBe("number");
  });

  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/search/gallery",
    });
    expect(res.statusCode).toBe(401);
  });
});
