/**
 * Tests for FR-07 AC-05: Queue routing rules CRUD.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FastifyInstance } from "fastify";
import { buildTestApp, getAuthToken, isDatabaseReady, authInject, NON_EXISTENT_UUID } from "../test-helpers";

let app: FastifyInstance;
let token: string | null;
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

describe("Queue Routing Rules (FR-07 AC-05)", () => {
  it("GET /api/v1/queue-routing/rules without auth returns 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/queue-routing/rules",
    });
    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady || !token)("GET /api/v1/queue-routing/rules returns rules array", async () => {
    const res = await authInject(app, token!, {
      method: "GET",
      url: "/api/v1/queue-routing/rules",
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty("rules");
    expect(Array.isArray(body.rules)).toBe(true);
  });

  it.skipIf(!dbReady || !token)("POST /api/v1/queue-routing/rules creates a rule", async () => {
    const res = await authInject(app, token!, {
      method: "POST",
      url: "/api/v1/queue-routing/rules",
      payload: {
        ruleName: "High risk terrorism",
        category: "TERRORISM",
        minRiskScore: 70,
        maxRiskScore: 100,
        targetQueue: "CRITICAL",
        priorityOrder: 1,
      },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty("rule");
    expect(body.rule.rule_name).toBe("High risk terrorism");
    expect(body.rule.target_queue).toBe("CRITICAL");
  });

  it.skipIf(!dbReady || !token)("POST /api/v1/queue-routing/rules validates targetQueue enum", async () => {
    const res = await authInject(app, token!, {
      method: "POST",
      url: "/api/v1/queue-routing/rules",
      payload: {
        ruleName: "Invalid queue",
        targetQueue: "INVALID",
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it.skipIf(!dbReady || !token)("PATCH /api/v1/queue-routing/rules/:ruleId with no fields returns 400", async () => {
    const res = await authInject(app, token!, {
      method: "PATCH",
      url: `/api/v1/queue-routing/rules/${NON_EXISTENT_UUID}`,
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it.skipIf(!dbReady || !token)("DELETE /api/v1/queue-routing/rules/:ruleId with nonexistent id returns 404", async () => {
    const res = await authInject(app, token!, {
      method: "DELETE",
      url: `/api/v1/queue-routing/rules/${NON_EXISTENT_UUID}`,
    });
    expect(res.statusCode).toBe(404);
  });

  it.skipIf(!dbReady || !token)("POST /api/v1/queue-routing/route with no classification returns 404", async () => {
    const res = await authInject(app, token!, {
      method: "POST",
      url: "/api/v1/queue-routing/route",
      payload: { contentId: NON_EXISTENT_UUID },
    });
    expect(res.statusCode).toBe(404);
  });
});
