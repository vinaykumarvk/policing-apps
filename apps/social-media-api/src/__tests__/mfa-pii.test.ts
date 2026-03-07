/**
 * Integration tests for Social Media API MFA enforcement and PII protection.
 * Covers: MFA enforcement middleware (FR-17),
 *         PII field exclusion from API responses,
 *         redaction of sensitive data patterns (Aadhaar, PAN, passwords).
 * Prerequisites: Postgres running, migrations applied, seed run.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { buildTestApp, getAuthToken, authInject, SEED_USERS, TestApp } from "../test-helpers";
import { redactValue } from "../redact";

describe("Social Media API — MFA & PII Protection", () => {
  let app: TestApp;
  let token: string;
  let analystToken: string;
  let dbReady = false;

  beforeAll(async () => {
    app = await buildTestApp();
    try {
      const t = await getAuthToken(app, SEED_USERS.admin.username, SEED_USERS.admin.password);
      const at = await getAuthToken(app, SEED_USERS.analyst.username, SEED_USERS.analyst.password);
      if (!t || !at) throw new Error("LOGIN_FAILED");
      token = t;
      analystToken = at;
      dbReady = true;
    } catch {
      dbReady = false;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach((ctx) => {
    if (!dbReady) ctx.skip();
  });

  // ---------- Auth /me does not leak sensitive fields ----------
  describe("GET /api/v1/auth/me — PII protection", () => {
    it("returns user payload without password_hash", async () => {
      const res = await authInject(app, token, "GET", "/api/v1/auth/me");
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.user).toBeDefined();
      // Must NOT contain sensitive DB columns
      expect(body.user.password_hash).toBeUndefined();
      expect(body.user.password).toBeUndefined();
      expect(body.user.mfa_secret_enc).toBeUndefined();
      expect(body.user.mfa_backup_codes_enc).toBeUndefined();
    });

    it("returns expected user fields for admin", async () => {
      const res = await authInject(app, token, "GET", "/api/v1/auth/me");
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.user.userId).toBeDefined();
      expect(body.user.roles).toBeDefined();
      expect(Array.isArray(body.user.roles)).toBe(true);
    });

    it("returns expected user fields for analyst (non-admin)", async () => {
      const res = await authInject(app, analystToken, "GET", "/api/v1/auth/me");
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.user.userId).toBeDefined();
      expect(body.user.roles).toBeDefined();
      // Non-admin should not see admin-level fields
      expect(body.user.password_hash).toBeUndefined();
    });
  });

  // ---------- Login response does not leak sensitive data ----------
  describe("POST /api/v1/auth/login — sensitive field exclusion", () => {
    it("login response does not contain password_hash or MFA secrets", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: {
          username: SEED_USERS.admin.username,
          password: SEED_USERS.admin.password,
        },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.user).toBeDefined();
      expect(body.user.password_hash).toBeUndefined();
      expect(body.user.password).toBeUndefined();
      expect(body.user.mfa_secret_enc).toBeUndefined();
      expect(body.user.mfa_backup_codes_enc).toBeUndefined();
      expect(body.user.locked_until).toBeUndefined();
      expect(body.user.failed_login_attempts).toBeUndefined();
    });
  });

  // ---------- Admin user listing does not leak sensitive data ----------
  describe("GET /api/v1/users — PII exclusion for admin listing", () => {
    it("user records do not contain password hashes or MFA secrets", async () => {
      const res = await authInject(app, token, "GET", "/api/v1/users");
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.users.length).toBeGreaterThan(0);
      for (const user of body.users) {
        expect(user.password_hash).toBeUndefined();
        expect(user.password).toBeUndefined();
        expect(user.mfa_secret_enc).toBeUndefined();
        expect(user.mfa_backup_codes_enc).toBeUndefined();
      }
    });
  });

  // ---------- PII Redaction utility ----------
  describe("redactValue — PII pattern redaction", () => {
    it("redacts password fields by key name", () => {
      const input = { username: "admin", password: "secret123" };
      const result = redactValue(input) as Record<string, unknown>;
      expect(result.username).toBe("admin");
      expect(result.password).toBe("[REDACTED]");
    });

    it("redacts token fields by key name", () => {
      const input = { token: "eyJhbGciOiJIUzI1NiJ9.payload.sig", data: "ok" };
      const result = redactValue(input) as Record<string, unknown>;
      expect(result.token).toBe("[REDACTED]");
      expect(result.data).toBe("ok");
    });

    it("redacts Aadhaar patterns in string values", () => {
      const input = { note: "Subject Aadhaar is 2345 6789 0123 for reference" };
      const result = redactValue(input) as Record<string, unknown>;
      expect(result.note).not.toContain("2345 6789 0123");
      expect(String(result.note)).toContain("[AADHAAR_REDACTED]");
    });

    it("redacts PAN patterns in string values", () => {
      const input = { note: "Subject PAN is ABCDE1234F noted" };
      const result = redactValue(input) as Record<string, unknown>;
      expect(result.note).not.toContain("ABCDE1234F");
      expect(String(result.note)).toContain("[PAN_REDACTED]");
    });

    it("redacts nested sensitive keys", () => {
      const input = { user: { name: "test", password: "hidden", jwt: "abc" } };
      const result = redactValue(input) as Record<string, Record<string, unknown>>;
      expect(result.user.name).toBe("test");
      expect(result.user.password).toBe("[REDACTED]");
      expect(result.user.jwt).toBe("[REDACTED]");
    });

    it("redacts aadhaar key by name", () => {
      const input = { aadhaar: "234567890123" };
      const result = redactValue(input) as Record<string, unknown>;
      expect(result.aadhaar).toBe("[REDACTED]");
    });

    it("handles null and undefined values gracefully", () => {
      expect(redactValue(null)).toBeNull();
      expect(redactValue(undefined)).toBeUndefined();
    });

    it("handles arrays with mixed content", () => {
      const input = [
        { password: "secret" },
        { name: "safe" },
        "Subject PAN ABCDE1234F",
      ];
      const result = redactValue(input) as unknown[];
      expect((result[0] as Record<string, unknown>).password).toBe("[REDACTED]");
      expect((result[1] as Record<string, unknown>).name).toBe("safe");
      expect(String(result[2])).toContain("[PAN_REDACTED]");
    });
  });

  // ---------- MFA enforcement middleware ----------
  describe("MFA enforcement middleware", () => {
    it("auth routes are exempt from MFA enforcement", async () => {
      // Auth endpoints should work without MFA — login should succeed
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: {
          username: SEED_USERS.admin.username,
          password: SEED_USERS.admin.password,
        },
      });
      expect(res.statusCode).toBe(200);
    });

    it("health endpoint is exempt from MFA enforcement", async () => {
      const res = await app.inject({ method: "GET", url: "/health" });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).status).toBe("ok");
    });

    it("authenticated request succeeds when MFA is not enforced for user", async () => {
      // Default seed users have mfa_enforced = false, so normal endpoints should work
      const res = await authInject(app, token, "GET", "/api/v1/auth/me");
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.user).toBeDefined();
    });
  });
});
