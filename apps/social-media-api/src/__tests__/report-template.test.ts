/**
 * Integration tests for Social Media API report templates and MIS queries (FR-13).
 * Covers: template CRUD, 6 MIS report endpoints, auth guard.
 */
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { buildTestApp, getAuthToken, authInject, SEED_USERS, NON_EXISTENT_UUID, TestApp } from "../test-helpers";

describe("Social Media API — Report Templates & MIS (FR-13)", () => {
  let app: TestApp;
  let token: string;
  let dbReady = false;

  beforeAll(async () => {
    app = await buildTestApp();
    try {
      const t = await getAuthToken(app, SEED_USERS.admin.username, SEED_USERS.admin.password);
      if (!t) throw new Error("LOGIN_FAILED");
      token = t;
      dbReady = true;
    } catch {
      dbReady = false;
    }
  });

  beforeEach((ctx) => {
    if (!dbReady) ctx.skip();
  });

  // ---------- Auth Guard ----------
  it("GET /api/v1/report-templates without auth returns 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/report-templates" });
    expect(res.statusCode).toBe(401);
  });

  it("POST /api/v1/report-templates without auth returns 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/report-templates",
      payload: { name: "Test", templateType: "SUMMARY" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("GET /api/v1/reports/mis/platform-summary without auth returns 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/reports/mis/platform-summary" });
    expect(res.statusCode).toBe(401);
  });

  // ---------- Template CRUD ----------
  describe("Report Templates", () => {
    let createdTemplateId: string;

    it("GET /api/v1/report-templates returns templates array with total", async () => {
      const res = await authInject(app, token, "GET", "/api/v1/report-templates");
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(Array.isArray(body.templates)).toBe(true);
      expect(typeof body.total).toBe("number");
    });

    it("POST /api/v1/report-templates creates a template", async () => {
      const res = await authInject(app, token, "POST", "/api/v1/report-templates", {
        name: "Integration Test Template",
        templateType: "SUMMARY",
        contentSchema: { fields: ["title", "description"] },
        contentJsonb: { header: "Test Report" },
        isActive: true,
      });
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.template).toBeDefined();
      expect(body.template.template_id).toBeDefined();
      expect(body.template.name).toBe("Integration Test Template");
      expect(body.template.template_type).toBe("SUMMARY");
      expect(body.template.is_active).toBe(true);
      expect(body.template.created_by).toBeDefined();
      createdTemplateId = body.template.template_id;
    });

    it("GET /api/v1/report-templates supports pagination", async () => {
      const res = await authInject(app, token, "GET", "/api/v1/report-templates?limit=2&offset=0");
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.templates.length).toBeLessThanOrEqual(2);
    });

    it("GET /api/v1/report-templates supports templateType filter", async () => {
      const res = await authInject(app, token, "GET", "/api/v1/report-templates?templateType=SUMMARY");
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(Array.isArray(body.templates)).toBe(true);
      for (const t of body.templates) {
        expect(t.template_type).toBe("SUMMARY");
      }
    });

    it("PATCH /api/v1/report-templates/:id updates a template", async () => {
      if (!createdTemplateId) return;
      const res = await authInject(app, token, "PATCH", `/api/v1/report-templates/${createdTemplateId}`, {
        name: "Updated Test Template",
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.template.name).toBe("Updated Test Template");
    });

    it("PATCH /api/v1/report-templates/:id with non-existent UUID returns 404", async () => {
      const res = await authInject(app, token, "PATCH", `/api/v1/report-templates/${NON_EXISTENT_UUID}`, {
        name: "Should Not Exist",
      });
      expect(res.statusCode).toBe(404);
      expect(JSON.parse(res.payload).error).toBe("TEMPLATE_NOT_FOUND");
    });

    it("DELETE /api/v1/report-templates/:id soft-deletes a template", async () => {
      if (!createdTemplateId) return;
      const res = await authInject(app, token, "DELETE", `/api/v1/report-templates/${createdTemplateId}`);
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
    });

    it("DELETE /api/v1/report-templates/:id with non-existent UUID returns 404", async () => {
      const res = await authInject(app, token, "DELETE", `/api/v1/report-templates/${NON_EXISTENT_UUID}`);
      expect(res.statusCode).toBe(404);
    });
  });

  // ---------- MIS Reports ----------
  describe("MIS Reports (FR-13)", () => {
    it("GET /api/v1/reports/mis/platform-summary returns summary and generatedAt", async () => {
      const res = await authInject(app, token, "GET", "/api/v1/reports/mis/platform-summary");
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(Array.isArray(body.summary)).toBe(true);
      expect(body.generatedAt).toBeDefined();
    });

    it("GET /api/v1/reports/mis/platform-summary supports date range filter", async () => {
      const res = await authInject(app, token, "GET", "/api/v1/reports/mis/platform-summary?from=2020-01-01&to=2030-12-31");
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(Array.isArray(body.summary)).toBe(true);
    });

    it("GET /api/v1/reports/mis/risk-distribution returns distribution and generatedAt", async () => {
      const res = await authInject(app, token, "GET", "/api/v1/reports/mis/risk-distribution");
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(Array.isArray(body.distribution)).toBe(true);
      expect(body.generatedAt).toBeDefined();
    });

    it("GET /api/v1/reports/mis/response-time returns metrics and generatedAt", async () => {
      const res = await authInject(app, token, "GET", "/api/v1/reports/mis/response-time");
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.metrics).toBeDefined();
      expect(body.generatedAt).toBeDefined();
    });

    it("GET /api/v1/reports/mis/category-trends returns trends, interval, and generatedAt", async () => {
      const res = await authInject(app, token, "GET", "/api/v1/reports/mis/category-trends");
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(Array.isArray(body.trends)).toBe(true);
      expect(body.interval).toBeDefined();
      expect(body.generatedAt).toBeDefined();
    });

    it("GET /api/v1/reports/mis/category-trends supports interval parameter", async () => {
      for (const interval of ["day", "week", "month"]) {
        const res = await authInject(app, token, "GET", `/api/v1/reports/mis/category-trends?interval=${interval}`);
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.payload);
        expect(body.interval).toBe(interval);
      }
    });

    it("GET /api/v1/reports/mis/analyst-workload returns analysts and generatedAt", async () => {
      const res = await authInject(app, token, "GET", "/api/v1/reports/mis/analyst-workload");
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(Array.isArray(body.analysts)).toBe(true);
      expect(body.generatedAt).toBeDefined();
    });

    it("GET /api/v1/reports/mis/escalation-funnel returns funnel, byAlertType, and generatedAt", async () => {
      const res = await authInject(app, token, "GET", "/api/v1/reports/mis/escalation-funnel");
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.funnel).toBeDefined();
      expect(Array.isArray(body.byAlertType)).toBe(true);
      expect(body.generatedAt).toBeDefined();
    });

    it("GET /api/v1/reports/mis/escalation-funnel supports date range filter", async () => {
      const res = await authInject(app, token, "GET", "/api/v1/reports/mis/escalation-funnel?from=2020-01-01&to=2030-12-31");
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.funnel).toBeDefined();
    });
  });
});
