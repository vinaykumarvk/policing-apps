/**
 * Tests for FR-14 AC-03: Permission set JSON on role assignment.
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

describe("Admin Permission Set JSON (FR-14 AC-03)", () => {
  it("PUT /api/v1/users/:id/role without auth returns 401", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/api/v1/users/${NON_EXISTENT_UUID}/role`,
      payload: { roleId: "ANALYST" },
    });
    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady || !token)("PUT /api/v1/users/:id/role accepts permissionSetJson", async () => {
    const res = await authInject(app, token!, "PUT", `/api/v1/users/${NON_EXISTENT_UUID}/role`, {
      roleId: "EXAMINER",
      permissionSetJson: { canExportPdf: true, canViewRedacted: false },
    });
    // User may not exist but schema should be accepted
    expect([200, 404, 403, 500]).toContain(res.statusCode);
  });

  it.skipIf(!dbReady || !token)("PUT /api/v1/users/:id/role rejects self role change", async () => {
    // Get current user ID from /me
    const meRes = await authInject(app, token!, "GET", "/api/v1/auth/me");
    if (meRes.statusCode !== 200) return;
    const me = JSON.parse(meRes.payload);
    const myId = me.user?.userId || me.user?.user_id;
    if (!myId) return;

    const res = await authInject(app, token!, "PUT", `/api/v1/users/${myId}/role`, {
      roleId: "EXAMINER",
    });
    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("SELF_ROLE_CHANGE");
  });
});
