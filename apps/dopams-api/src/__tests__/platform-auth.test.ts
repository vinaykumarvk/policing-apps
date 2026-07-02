import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import type { AuthPayload } from "@puda/api-core";
import claimFixtures from "../../../../docs/spec/auth-claim-fixtures.json";
import type { ClearanceLevel, PlatformClaims } from "@policing-platform/authz";
import {
  evaluateDopamsPlatformAuth,
  registerDopamsPlatformAuthMiddleware,
} from "../middleware/platform-auth";

interface ClaimFixture {
  id: string;
  claim: PlatformClaims;
}

interface ClaimFixtureDocument {
  personas: ClaimFixture[];
}

const NOW = "2026-07-01T18:45:00Z";
const typedClaimFixtures = claimFixtures as ClaimFixtureDocument;

function persona(id: string): PlatformClaims {
  const found = typedClaimFixtures.personas.find((entry) => entry.id === id);
  if (!found) {
    throw new Error(`missing persona ${id}`);
  }
  return structuredClone(found.claim);
}

function platformDecision(claim: PlatformClaims, overrides: { serverVerified?: boolean } = {}) {
  return evaluateDopamsPlatformAuth(
    {
      claims: claim,
      serverVerified: overrides.serverVerified ?? true,
      servicePath: "/api/v1/cases",
      correlationId: "corr-dopams-test",
    },
    { now: NOW },
  );
}

function withJurisdiction(claim: PlatformClaims, district: string): PlatformClaims {
  return {
    ...claim,
    jurisdiction: {
      ...claim.jurisdiction,
      districts: [district],
      police_stations: ["Civil Lines"],
    },
  };
}

function withClearance(claim: PlatformClaims, level: ClearanceLevel): PlatformClaims {
  return {
    ...claim,
    clearance: {
      ...claim.clearance,
      level,
    },
  };
}

function withStaleIssueTime(claim: PlatformClaims): PlatformClaims {
  return {
    ...claim,
    issued_at: "2026-07-01T18:00:00Z",
    expires_at: "2026-07-01T19:30:00Z",
  };
}

const localAuthUser: AuthPayload = {
  userId: "local-domain-user",
  userType: "ADMINISTRATOR",
  roles: ["ADMINISTRATOR"],
  jti: "local-jti",
  unitId: "narcotics-cell-mohali",
};

describe("DOPAMS platform auth adapter", () => {
  afterEach(() => {
    delete process.env.DOPAMS_PLATFORM_REVOKED_SESSIONS;
    delete process.env.DOPAMS_PLATFORM_BREAK_GLASS_UNTIL;
    delete process.env.DOPAMS_PLATFORM_BREAK_GLASS_REASON;
  });

  it("allows a server-verified DOPAMS platform claim and records decision evidence", () => {
    const decision = platformDecision(persona("io"));

    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe("ALLOW");
    expect(decision.evidence.gate_evidence_ref).toBe("P8-dopams-platform-auth-adapter");
    expect(decision.evidence.claims_snapshot?.subject_id).toBe("user-io-001");
    expect(decision.evidence.local_auth_required).toBe(true);
  });

  it("denies a local-authenticated platform launch when server claim verification is missing", () => {
    const decision = platformDecision(persona("io"), { serverVerified: false });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("SERVER_VERIFICATION_REQUIRED");
    expect(decision.evidence.outcome).toBe("DENY");
  });

  it("denies wrong module, jurisdiction, clearance, stale claim, and revocation cases", () => {
    expect(platformDecision(persona("desk-operator")).reason).toBe("MODULE_DENIED");
    expect(platformDecision(withJurisdiction(persona("io"), "Ludhiana")).reason).toBe("JURISDICTION_DENIED");
    expect(platformDecision(withClearance(persona("io"), "restricted")).reason).toBe("CLEARANCE_DENIED");
    expect(platformDecision(withStaleIssueTime(persona("io"))).reason).toBe("CLAIM_STALE");

    const revokedClaim = persona("io");
    const revoked = evaluateDopamsPlatformAuth(
      {
        claims: revokedClaim,
        serverVerified: true,
        servicePath: "/api/v1/cases",
        correlationId: "corr-revoked",
      },
      { now: NOW, revokedSessionIds: [revokedClaim.session_id] },
    );
    expect(revoked.allowed).toBe(false);
    expect(revoked.reason).toBe("PLATFORM_SESSION_REVOKED");
  });

  it("allows only audited and time-boxed break-glass decisions", () => {
    const allowed = evaluateDopamsPlatformAuth(
      {
        serverVerified: false,
        servicePath: "/api/v1/cases",
        correlationId: "corr-break-glass",
        breakGlass: {
          requested: true,
          expiresAt: "2026-07-01T18:50:00Z",
          reason: "incident commander approval INC-001",
        },
      },
      { now: NOW },
    );

    expect(allowed.allowed).toBe(true);
    expect(allowed.evidence.break_glass?.expires_at).toBe("2026-07-01T18:50:00.000Z");
    expect(allowed.evidence.break_glass?.reason).toContain("INC-001");

    const expired = evaluateDopamsPlatformAuth(
      {
        serverVerified: false,
        servicePath: "/api/v1/cases",
        correlationId: "corr-break-glass-expired",
        breakGlass: {
          requested: true,
          expiresAt: "2026-07-01T18:44:00Z",
          reason: "expired approval",
        },
      },
      { now: NOW },
    );
    expect(expired.allowed).toBe(false);
    expect(expired.reason).toBe("BREAK_GLASS_EXPIRED");
  });

  it("does not let local/domain auth bypass platform decision evidence for platform-launched routes", async () => {
    const app = Fastify({ logger: false });
    app.addHook("preHandler", async (request) => {
      request.authUser = localAuthUser;
    });
    registerDopamsPlatformAuthMiddleware(app, { now: NOW });
    app.get("/api/v1/cases", async (request) => ({
      ok: true,
      platformAuthOutcome: request.platformAuth?.outcome ?? "none",
    }));

    const platformWithoutClaims = await app.inject({
      method: "GET",
      url: "/api/v1/cases",
      headers: { "x-platform-launch": "true" },
    });
    expect(platformWithoutClaims.statusCode).toBe(403);
    expect(JSON.parse(platformWithoutClaims.body).reason).toBe("PLATFORM_CLAIMS_REQUIRED");

    const directLocal = await app.inject({
      method: "GET",
      url: "/api/v1/cases",
    });
    expect(directLocal.statusCode).toBe(200);
    expect(JSON.parse(directLocal.body).platformAuthOutcome).toBe("none");

    await app.close();
  });

  it("enforces claim headers in the Fastify middleware for verified platform launches", async () => {
    const app = Fastify({ logger: false });
    app.addHook("preHandler", async (request) => {
      request.authUser = localAuthUser;
    });
    registerDopamsPlatformAuthMiddleware(app, { now: NOW });
    app.get("/api/v1/cases", async (request) => ({
      ok: true,
      platformAuthOutcome: request.platformAuth?.outcome ?? "none",
    }));

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/cases",
      headers: {
        "x-platform-launch": "true",
        "x-platform-claims": JSON.stringify(persona("io")),
        "x-platform-claims-verified": "true",
      },
    });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).platformAuthOutcome).toBe("ALLOW");

    await app.close();
  });
});
