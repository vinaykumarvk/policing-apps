import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, getAuthToken, authInject, isDatabaseReady } from "../test-helpers";
import { FastifyInstance } from "fastify";

let app: FastifyInstance;
let token: string;
let dbReady = false;

const NON_EXISTENT_UUID = "00000000-0000-0000-0000-000000000000";

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

describe("Alert Lifecycle — GET /api/v1/alert-rules", () => {
  it.skipIf(!dbReady)("returns an array of alert rules", async () => {
    const res = await authInject(app, token, "GET", "/api/v1/alert-rules");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.rules).toBeInstanceOf(Array);
    expect(typeof body.total).toBe("number");
  });
});

describe("Alert Lifecycle — POST /api/v1/alert-rules", () => {
  it.skipIf(!dbReady)("creates an alert rule", async () => {
    const res = await authInject(app, token, "POST", "/api/v1/alert-rules", {
      ruleName: "Test Critical Evidence Rule",
      entityType: "evidence",
      eventType: "CREATED",
      conditions: { severity: "CRITICAL" },
      alertType: "RULE_TRIGGERED",
      severity: "HIGH",
      slaHours: 12,
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.rule).toBeDefined();
    expect(body.rule.rule_id).toBeDefined();
    expect(body.rule.rule_name).toBe("Test Critical Evidence Rule");
  });
});

describe("Alert Lifecycle — POST /api/v1/alerts/:id/assign", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/alerts/${NON_EXISTENT_UUID}/assign`,
      payload: { assignedTo: NON_EXISTENT_UUID },
    });
    expect(res.statusCode).toBe(401);
  });
});
