import { describe, expect, it } from "vitest";
import { evaluateEntitlement, validatePlatformClaims } from "../../../../packages/authz/src";
import { createPlatformAppRegistry } from "../app-registry";
import {
  base32Decode,
  createSessionToken,
  hashPassword,
  totpCode,
  verifyPassword,
  verifySessionToken,
  verifyTotp,
} from "../auth/crypto";
import { createAuthGateway } from "../auth/gateway";
import {
  createInMemoryIdentityStore,
  mintPlatformClaims,
  type PlatformUser,
  type UserEntitlement,
} from "../auth/identity";

const NOW = new Date("2026-07-02T10:00:00Z");
const SECRET = "test-session-secret";
// RFC 6238 test secret: ASCII "12345678901234567890"
const RFC_TOTP_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

const TEST_USER: PlatformUser = {
  userId: "user-test-1",
  username: "inspector",
  passwordHash: hashPassword("correct horse battery staple"),
  totpSecret: RFC_TOTP_SECRET,
  displayName: "Test Inspector",
  persona: "platform_admin",
  tenantId: "punjab-police",
  orgId: "mohali-district",
  unitIds: ["narcotics-cell-mohali", "desk-mohali"],
  orgScope: "unit",
  jurisdiction: {
    country: "IN",
    state: "PB",
    districts: ["SAS Nagar"],
    police_stations: ["Phase-8"],
    scope: "station",
  },
  clearance: { level: "secret", compartments: ["platform_admin", "casework"] },
  assignment: {
    case_ids: ["CASE-DOPAMS-001"],
    queue_ids: ["desk-mohali-intake"],
    evidence_ids: ["EVID-DOPAMS-001"],
    jurisdiction_wide: false,
    domain_wide: false,
  },
  purposeAllowed: ["investigation", "complaint_intake", "platform_administration"],
  status: "active",
};

const TEST_ENTITLEMENTS: UserEntitlement[] = [
  { module: "platform_admin", domain: "platform", permissions: ["registry:read"] },
  { module: "dopams", domain: "dopams", permissions: ["case:read", "evidence:metadata-read"] },
];

function makeGateway(user: PlatformUser = TEST_USER) {
  const store = createInMemoryIdentityStore([user], { [user.userId]: TEST_ENTITLEMENTS });
  return createAuthGateway({ store, sessionSecret: SECRET, now: () => NOW, secureCookies: false });
}

function loginRequest(body: unknown): Request {
  return new Request("http://platform/api/v1/platform/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("auth crypto", () => {
  it("verifies RFC 6238 SHA-1 test vector (T=59s -> 287082)", () => {
    expect(totpCode(RFC_TOTP_SECRET, 59_000)).toBe("287082");
  });

  it("decodes base32", () => {
    expect(base32Decode(RFC_TOTP_SECRET).toString("ascii")).toBe("12345678901234567890");
  });

  it("accepts adjacent TOTP windows and rejects others", () => {
    const epoch = NOW.getTime();
    expect(verifyTotp(RFC_TOTP_SECRET, totpCode(RFC_TOTP_SECRET, epoch), epoch)).toBe(true);
    expect(verifyTotp(RFC_TOTP_SECRET, totpCode(RFC_TOTP_SECRET, epoch, -1), epoch)).toBe(true);
    expect(verifyTotp(RFC_TOTP_SECRET, totpCode(RFC_TOTP_SECRET, epoch, 5), epoch)).toBe(false);
    expect(verifyTotp(RFC_TOTP_SECRET, "not-a-code", epoch)).toBe(false);
  });

  it("round-trips scrypt password hashes and rejects wrong passwords", () => {
    const hash = hashPassword("s3cret!");
    expect(verifyPassword("s3cret!", hash)).toBe(true);
    expect(verifyPassword("wrong", hash)).toBe(false);
    expect(verifyPassword("s3cret!", "garbage")).toBe(false);
  });

  it("rejects tampered and expired session tokens", () => {
    const token = createSessionToken("user-1", SECRET, NOW.getTime(), 3600);
    expect(verifySessionToken(token, SECRET, NOW.getTime())?.userId).toBe("user-1");
    expect(verifySessionToken(token + "x", SECRET, NOW.getTime())).toBeNull();
    expect(verifySessionToken(token, "other-secret", NOW.getTime())).toBeNull();
    expect(verifySessionToken(token, SECRET, NOW.getTime() + 3601 * 1000)).toBeNull();
  });
});

describe("claims minting", () => {
  it("mints claims that pass validatePlatformClaims", () => {
    const claims = mintPlatformClaims({
      user: TEST_USER,
      entitlements: TEST_ENTITLEMENTS,
      sessionId: "sess-abc",
      mfaVerifiedAt: NOW.toISOString(),
      now: NOW,
    });
    const validation = validatePlatformClaims(claims, { now: NOW });
    expect(validation.valid).toBe(true);
    expect(claims.modules).toEqual(["platform_admin", "dopams"]);
    expect(claims.mfa.verified).toBe(true);
    expect(claims.mfa.methods).toEqual(["totp"]);
  });

  it("mints claims that pass a registry entitlement check (requireMfa)", () => {
    const claims = mintPlatformClaims({
      user: TEST_USER,
      entitlements: TEST_ENTITLEMENTS,
      sessionId: "sess-abc",
      mfaVerifiedAt: NOW.toISOString(),
      now: NOW,
    });
    const dopams = createPlatformAppRegistry().find((app) => app.id === "dopams");
    expect(dopams?.entitlement_request).toBeDefined();
    const decision = evaluateEntitlement(
      claims,
      { ...dopams!.entitlement_request!, serverVerified: true },
      { now: NOW },
    );
    expect(decision.reason).toBe("ALLOW");
    expect(decision.allowed).toBe(true);
  });
});

describe("auth gateway", () => {
  const validLogin = () => ({
    username: "inspector",
    password: "correct horse battery staple",
    totp: totpCode(RFC_TOTP_SECRET, NOW.getTime()),
  });

  it("rejects wrong password and wrong TOTP", async () => {
    const gateway = makeGateway();
    const badPassword = await gateway.handleAuthRoute(
      loginRequest({ ...validLogin(), password: "wrong" }),
    );
    expect(badPassword?.status).toBe(401);
    const badTotp = await gateway.handleAuthRoute(loginRequest({ ...validLogin(), totp: "000000" }));
    expect(badTotp?.status).toBe(401);
  });

  it("rejects disabled users", async () => {
    const gateway = makeGateway({ ...TEST_USER, status: "disabled" });
    const response = await gateway.handleAuthRoute(loginRequest(validLogin()));
    expect(response?.status).toBe(401);
  });

  it("locks after repeated failures", async () => {
    const gateway = makeGateway();
    for (let i = 0; i < 5; i += 1) {
      await gateway.handleAuthRoute(loginRequest({ ...validLogin(), password: "wrong" }));
    }
    const locked = await gateway.handleAuthRoute(loginRequest(validLogin()));
    expect(locked?.status).toBe(429);
  });

  it("logs in, reports the session, and injects verified claims", async () => {
    const gateway = makeGateway();
    const login = await gateway.handleAuthRoute(loginRequest(validLogin()));
    expect(login?.status).toBe(200);
    const setCookie = login?.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("platform_session=");
    const cookie = setCookie.split(";")[0];

    const session = await gateway.handleAuthRoute(
      new Request("http://platform/api/v1/platform/auth/session", { headers: { cookie } }),
    );
    expect(await session?.json()).toMatchObject({
      authenticated: true,
      user: { username: "inspector" },
    });

    const headers = await gateway.claimsHeadersFor(
      new Request("http://platform/api/v1/platform/apps", { headers: { cookie } }),
    );
    expect(headers).not.toBeNull();
    expect(headers?.["x-platform-claims-verified"]).toBe("true");
    const claims = JSON.parse(headers!["x-platform-claims"]);
    expect(validatePlatformClaims(claims, { now: NOW }).valid).toBe(true);
  });

  it("demo mode: password-only login works and claims record the password method", async () => {
    const store = createInMemoryIdentityStore([TEST_USER], { [TEST_USER.userId]: TEST_ENTITLEMENTS });
    const demoGateway = createAuthGateway({
      store,
      sessionSecret: SECRET,
      now: () => NOW,
      secureCookies: false,
      allowPasswordOnly: true,
    });
    const login = await demoGateway.handleAuthRoute(
      loginRequest({ username: "inspector", password: "correct horse battery staple" }),
    );
    expect(login?.status).toBe(200);
    const cookie = (login?.headers.get("set-cookie") ?? "").split(";")[0];
    const headers = await demoGateway.claimsHeadersFor(
      new Request("http://platform/api/v1/platform/apps", { headers: { cookie } }),
    );
    const claims = JSON.parse(headers!["x-platform-claims"]);
    expect(claims.mfa.methods).toEqual(["password"]);
    expect(validatePlatformClaims(claims, { now: NOW }).valid).toBe(true);

    const config = await demoGateway.handleAuthRoute(
      new Request("http://platform/api/v1/platform/auth/config"),
    );
    expect(await config?.json()).toEqual({ password_only_login: true });
  });

  it("demo mode off: login without TOTP is rejected and config reports it", async () => {
    const strictGateway = makeGateway();
    const missingTotp = await strictGateway.handleAuthRoute(
      loginRequest({ username: "inspector", password: "correct horse battery staple" }),
    );
    expect(missingTotp?.status).toBe(400);
    const config = await strictGateway.handleAuthRoute(
      new Request("http://platform/api/v1/platform/auth/config"),
    );
    expect(await config?.json()).toEqual({ password_only_login: false });
  });

  it("returns no claims without a session and clears the cookie on logout", async () => {
    const gateway = makeGateway();
    expect(
      await gateway.claimsHeadersFor(new Request("http://platform/api/v1/platform/apps")),
    ).toBeNull();
    const logout = await gateway.handleAuthRoute(
      new Request("http://platform/api/v1/platform/auth/logout", { method: "POST" }),
    );
    expect(logout?.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});
