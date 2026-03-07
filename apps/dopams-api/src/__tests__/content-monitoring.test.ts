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

describe("Content Monitoring — FR-19", () => {
  let createdContentId: string;

  it.skipIf(!dbReady)("POST /api/v1/content/ingest ingests batch content items", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/content/ingest",
      payload: {
        items: [
          {
            sourcePlatform: "TWITTER",
            contentType: "TEXT",
            rawText: "Suspicious activity detected near railway station",
            authorHandle: "@testuser1",
            riskScore: 75.5,
            classifiedCategory: "THREAT",
          },
          {
            sourcePlatform: "FACEBOOK",
            rawText: "Normal social media post",
            authorHandle: "@testuser2",
            riskScore: 10.0,
          },
        ],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.ingested).toBe(2);
    expect(body.items).toHaveLength(2);
    expect(body.items[0].source_platform).toBe("TWITTER");
    expect(body.items[0].state_id).toBe("NEW");
    createdContentId = body.items[0].content_id;
  });

  it.skipIf(!dbReady)("GET /api/v1/content lists content with filters", async () => {
    const res = await authInject(app, token, {
      method: "GET",
      url: "/api/v1/content?limit=10",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.content).toBeInstanceOf(Array);
    expect(typeof body.total).toBe("number");
  });

  it.skipIf(!dbReady)("GET /api/v1/content filters by platform", async () => {
    const res = await authInject(app, token, {
      method: "GET",
      url: "/api/v1/content?source_platform=TWITTER",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    for (const item of body.content) {
      expect(item.source_platform).toBe("TWITTER");
    }
  });

  it.skipIf(!dbReady)("GET /api/v1/content/:id returns content item", async () => {
    if (!createdContentId) return;
    const res = await authInject(app, token, {
      method: "GET",
      url: `/api/v1/content/${createdContentId}`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.content.content_id).toBe(createdContentId);
  });

  it.skipIf(!dbReady)("POST /api/v1/content/:id/transition transitions NEW → REVIEWING", async () => {
    if (!createdContentId) return;
    const res = await authInject(app, token, {
      method: "POST",
      url: `/api/v1/content/${createdContentId}/transition`,
      payload: { targetState: "REVIEWING" },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.newState).toBe("REVIEWING");
  });

  it.skipIf(!dbReady)("POST /api/v1/content/:id/transition transitions REVIEWING → ESCALATED", async () => {
    if (!createdContentId) return;
    const res = await authInject(app, token, {
      method: "POST",
      url: `/api/v1/content/${createdContentId}/transition`,
      payload: { targetState: "ESCALATED" },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.newState).toBe("ESCALATED");
  });

  it.skipIf(!dbReady)("POST /api/v1/content/:id/transition rejects invalid transition", async () => {
    if (!createdContentId) return;
    // ESCALATED → NEW is not allowed
    const res = await authInject(app, token, {
      method: "POST",
      url: `/api/v1/content/${createdContentId}/transition`,
      payload: { targetState: "NEW" },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("INVALID_TRANSITION");
  });

  it.skipIf(!dbReady)("GET /api/v1/content/dashboard returns stats", async () => {
    const res = await authInject(app, token, {
      method: "GET",
      url: "/api/v1/content/dashboard",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.totals).toBeDefined();
    expect(typeof body.totals.total).toBe("number");
    expect(body.byPlatform).toBeInstanceOf(Array);
    expect(body.byCategory).toBeInstanceOf(Array);
  });

  it.skipIf(!dbReady)("GET /api/v1/content/:id returns 404 for non-existent ID", async () => {
    const res = await authInject(app, token, {
      method: "GET",
      url: "/api/v1/content/00000000-0000-0000-0000-000000000000",
    });
    expect(res.statusCode).toBe(404);
  });
});

describe("Monitoring Rules — FR-19", () => {
  let createdRuleId: string;

  it.skipIf(!dbReady)("POST /api/v1/content/rules creates monitoring rule", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/content/rules",
      payload: {
        ruleType: "KEYWORD",
        pattern: "drug|narcotics|contraband",
        platforms: ["TWITTER", "FACEBOOK"],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.rule.rule_type).toBe("KEYWORD");
    expect(body.rule.is_active).toBe(true);
    createdRuleId = body.rule.rule_id;
  });

  it.skipIf(!dbReady)("GET /api/v1/content/rules lists active rules", async () => {
    const res = await authInject(app, token, {
      method: "GET",
      url: "/api/v1/content/rules",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.rules).toBeInstanceOf(Array);
  });

  it.skipIf(!dbReady)("DELETE /api/v1/content/rules/:id deactivates rule", async () => {
    if (!createdRuleId) return;
    const res = await authInject(app, token, {
      method: "DELETE",
      url: `/api/v1/content/rules/${createdRuleId}`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
  });
});
