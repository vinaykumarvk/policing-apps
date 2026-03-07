import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, getAuthToken, authInject, NON_EXISTENT_UUID } from "../test-helpers";

let app: any;
let token: string;
let dbReady = false;

beforeAll(async () => {
  app = await buildTestApp();
  const t = await getAuthToken(app);
  if (t) { token = t; dbReady = true; }
});
afterAll(async () => { await app.close(); });

describe("Reports — GET /api/v1/cases/:caseId/reports", () => {
  it("returns reports array and total for a case", async () => {
    if (!dbReady) return;
    const res = await authInject(
      app, token, "GET",
      `/api/v1/cases/${NON_EXISTENT_UUID}/reports`,
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.reports).toBeInstanceOf(Array);
    expect(typeof body.total).toBe("number");
  });

  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/cases/${NON_EXISTENT_UUID}/reports`,
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("Reports — POST /api/v1/reports", () => {
  it("returns 404 when case does not exist", async () => {
    if (!dbReady) return;
    const res = await authInject(app, token, "POST", "/api/v1/reports", {
      caseId: NON_EXISTENT_UUID,
      title: "Test Report",
    });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("CASE_NOT_FOUND");
  });

  it("returns 400 when required fields are missing", async () => {
    if (!dbReady) return;
    const res = await authInject(app, token, "POST", "/api/v1/reports", {});
    expect(res.statusCode).toBe(400);
  });

  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/reports",
      payload: { caseId: NON_EXISTENT_UUID, title: "Test" },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("Reports — GET /api/v1/reports/:id/pdf", () => {
  it("returns 404 for non-existent report", async () => {
    if (!dbReady) return;
    const res = await authInject(
      app, token, "GET",
      `/api/v1/reports/${NON_EXISTENT_UUID}/pdf`,
    );
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("REPORT_NOT_FOUND");
  });
});

describe("Reports — GET /api/v1/reports/:id/docx", () => {
  it("returns 404 for non-existent report", async () => {
    if (!dbReady) return;
    const res = await authInject(
      app, token, "GET",
      `/api/v1/reports/${NON_EXISTENT_UUID}/docx`,
    );
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("REPORT_NOT_FOUND");
  });
});

describe("Reports — POST /api/v1/reports/:id/export", () => {
  it("returns 404 for non-existent report export", async () => {
    if (!dbReady) return;
    const res = await authInject(
      app, token, "POST",
      `/api/v1/reports/${NON_EXISTENT_UUID}/export`,
    );
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("REPORT_NOT_FOUND");
  });
});

describe("Reports — GET /api/v1/reports/:id/transitions", () => {
  it("returns 404 for non-existent report", async () => {
    if (!dbReady) return;
    const res = await authInject(
      app, token, "GET",
      `/api/v1/reports/${NON_EXISTENT_UUID}/transitions`,
    );
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("REPORT_NOT_FOUND");
  });
});

describe("Reports — Redaction Profiles", () => {
  it("lists redaction profiles", async () => {
    if (!dbReady) return;
    const res = await authInject(app, token, "GET", "/api/v1/redaction-profiles");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.profiles).toBeInstanceOf(Array);
  });

  it("creates a redaction profile", async () => {
    if (!dbReady) return;
    const res = await authInject(app, token, "POST", "/api/v1/redaction-profiles", {
      profileName: "Test Redaction Profile",
      rules: [{ pattern: "\\d{12}", replacement: "[AADHAAR REDACTED]" }],
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.profile).toBeDefined();
    expect(body.profile.profile_name).toBe("Test Redaction Profile");
  });
});
