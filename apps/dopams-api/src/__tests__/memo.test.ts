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

describe("Memo Routes", () => {
  it("GET /api/v1/memos without auth returns 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/memos",
    });

    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady)("GET /api/v1/memos returns memos array with total", async () => {
    const res = await authInject(app, token, { method: "GET", url: "/api/v1/memos" });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("memos");
    expect(body).toHaveProperty("total");
    expect(Array.isArray(body.memos)).toBe(true);
    expect(typeof body.total).toBe("number");
  });

  it.skipIf(!dbReady)("GET /api/v1/memos supports pagination", async () => {
    const res = await authInject(app, token, {
      method: "GET",
      url: "/api/v1/memos?limit=5&offset=0",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("memos");
    expect(body.memos.length).toBeLessThanOrEqual(5);
  });

  it.skipIf(!dbReady)("POST /api/v1/memos creates a new memo", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/memos",
      payload: {
        subject: "Test memo subject",
        body: "Test memo body content for integration test",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("memo");
    expect(body.memo.memo_number).toMatch(/^DOP-MEMO-/);
    expect(body.memo.subject).toBe("Test memo subject");
    expect(body.memo).toHaveProperty("state_id");
    expect(body.memo).toHaveProperty("created_by");
  });

  it.skipIf(!dbReady)("GET /api/v1/memos/:id returns 404 for missing UUID", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await authInject(app, token, {
      method: "GET",
      url: `/api/v1/memos/${fakeId}`,
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("MEMO_NOT_FOUND");
  });

  it.skipIf(!dbReady)("GET /api/v1/memos/:id/transitions returns 404 for missing memo", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await authInject(app, token, {
      method: "GET",
      url: `/api/v1/memos/${fakeId}/transitions`,
    });

    expect(res.statusCode).toBe(404);
  });

  it.skipIf(!dbReady)("POST /api/v1/memos/:id/transition returns error for missing memo", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await authInject(app, token, {
      method: "POST",
      url: `/api/v1/memos/${fakeId}/transition`,
      payload: { transitionId: "submit" },
    });

    // Transition on non-existent memo should fail (409 or 404 depending on workflow bridge)
    expect([404, 409]).toContain(res.statusCode);
  });
});
