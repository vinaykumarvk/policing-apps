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
    token = await getAuthToken(app, "admin", "password");
  }
});

afterAll(async () => {
  await app.close();
});

describe("UNOCross Routes", () => {
  it("GET /api/v1/unocross/rules without auth returns 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/unocross/rules",
    });

    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady)("GET /api/v1/unocross/rules returns rules array", async () => {
    const res = await authInject(app, token, { method: "GET", url: "/api/v1/unocross/rules" });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("rules");
    expect(Array.isArray(body.rules)).toBe(true);
  });

  it.skipIf(!dbReady)("POST /api/v1/unocross/rules creates a rule", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/unocross/rules",
      payload: {
        ruleName: "Integration Test Rule",
        ruleType: "THRESHOLD",
        conditions: { amount: { gt: 100000 } },
        severity: "HIGH",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("rule");
    expect(body.rule.rule_name).toBe("Integration Test Rule");
  });

  it.skipIf(!dbReady)("GET /api/v1/unocross/templates returns templates array", async () => {
    const res = await authInject(app, token, { method: "GET", url: "/api/v1/unocross/templates" });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("templates");
    expect(Array.isArray(body.templates)).toBe(true);
  });
});
