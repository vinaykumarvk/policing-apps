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

describe("LDAP Auth Stub — FR-01", () => {
  it("POST /api/v1/auth/ldap without auth returns 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/ldap",
      payload: {
        username: "testuser",
        password: "testpass",
        domain: "police.gov.in",
      },
    });

    expect(res.statusCode).toBe(401);
  });

  it.skipIf(!dbReady)("POST /api/v1/auth/ldap with valid fields returns 501 LDAP_NOT_CONFIGURED", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/auth/ldap",
      payload: {
        username: "testuser",
        password: "testpass",
        domain: "police.gov.in",
      },
    });

    expect(res.statusCode).toBe(501);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("LDAP_NOT_CONFIGURED");
    expect(body.message).toBe("LDAP integration requires infrastructure setup");
  });

  it.skipIf(!dbReady)("POST /api/v1/auth/ldap with missing username returns 400", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/auth/ldap",
      payload: {
        password: "testpass",
        domain: "police.gov.in",
      },
    });

    // Fastify schema validation: username is required
    expect(res.statusCode).toBe(400);
  });

  it.skipIf(!dbReady)("POST /api/v1/auth/ldap with missing password returns 400", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/auth/ldap",
      payload: {
        username: "testuser",
        domain: "police.gov.in",
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it.skipIf(!dbReady)("POST /api/v1/auth/ldap with missing domain returns 400", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/auth/ldap",
      payload: {
        username: "testuser",
        password: "testpass",
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it.skipIf(!dbReady)("POST /api/v1/auth/ldap with empty body returns 400", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/auth/ldap",
      payload: {},
    });

    expect(res.statusCode).toBe(400);
  });

  it.skipIf(!dbReady)("POST /api/v1/auth/ldap with all valid credentials still returns 501", async () => {
    // Even with perfectly valid credentials, LDAP is not implemented
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/auth/ldap",
      payload: {
        username: "admin",
        password: "password",
        domain: "internal.police.gov.in",
      },
    });

    expect(res.statusCode).toBe(501);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("LDAP_NOT_CONFIGURED");
  });

  it.skipIf(!dbReady)("POST /api/v1/auth/ldap rejects additional properties", async () => {
    const res = await authInject(app, token, {
      method: "POST",
      url: "/api/v1/auth/ldap",
      payload: {
        username: "testuser",
        password: "testpass",
        domain: "police.gov.in",
        extraField: "should be rejected",
      },
    });

    // additionalProperties: false causes schema validation failure
    expect(res.statusCode).toBe(400);
  });
});
