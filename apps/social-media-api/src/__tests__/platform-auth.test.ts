import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import type { AuthPayload } from "@puda/api-core";
import claimFixtures from "../../../../docs/spec/auth-claim-fixtures.json";
import type { ClearanceLevel, PlatformClaims } from "@policing-platform/authz";
import {
  evaluateSocialMediaPlatformAuth,
  registerSocialMediaPlatformAuthMiddleware,
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

function platformDecision(claim: unknown, overrides: { serverVerified?: boolean } = {}) {
  return evaluateSocialMediaPlatformAuth(
    {
      claims: claim,
      serverVerified: overrides.serverVerified ?? true,
      servicePath: "/api/v1/content",
      correlationId: "corr-social-media-test",
    },
    { now: NOW },
  );
}

function withWrongJurisdiction(claim: PlatformClaims): PlatformClaims {
  return {
    ...claim,
    jurisdiction: {
      ...claim.jurisdiction,
      state: "HR",
      districts: ["Gurugram"],
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

function withoutQueueAssignment(claim: PlatformClaims): PlatformClaims {
  return {
    ...claim,
    assignment: {
      ...claim.assignment,
      queue_ids: [],
      jurisdiction_wide: false,
      domain_wide: false,
    },
  };
}

function withWrongPurpose(claim: PlatformClaims): PlatformClaims {
  return {
    ...claim,
    purpose: {
      allowed: ["case_review"],
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
  userId: "local-social-media-domain-user",
  userType: "ADMINISTRATOR",
  roles: ["ADMINISTRATOR"],
  jti: "local-social-media-jti",
  unitId: "analysis-cell",
};

describe("Social Media platform auth adapter", () => {
  afterEach(() => {
    delete process.env.SOCIAL_MEDIA_PLATFORM_REVOKED_SESSIONS;
  });

  it("allows a server-verified Social Media platform claim and records decision evidence", () => {
    const decision = platformDecision(persona("analyst"));

    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe("ALLOW");
    expect(decision.evidence.adapter_version).toBe("social-media-platform-auth-adapter.v1");
    expect(decision.evidence.gate_evidence_ref).toBe("P14-social-media-platform-auth-adapter");
    expect(decision.evidence.policy_version).toBe("platform.entitlements.v1");
    expect(decision.evidence.service_path).toBe("/api/v1/content");
    expect(decision.evidence.correlation_id).toBe("corr-social-media-test");
    expect(decision.evidence.source_version).toBe("social-media-api");
    expect(decision.evidence.projection_version).toBe("not_applicable");
    expect(decision.evidence.redaction_decision).toBe("metadata_only");
    expect(decision.evidence.server_verified).toBe(true);
    expect(decision.evidence.local_auth_required).toBe(true);
    expect(decision.evidence.claims_snapshot?.subject_id).toBe("user-analyst-001");
    expect(decision.evidence.claims_snapshot?.domain_permissions).toContainEqual({
      domain: "social_media",
      permissions: ["content:metadata-read", "trend:read"],
    });
  });

  it("denies missing, malformed, and unverified platform claims", () => {
    const missingClaims = evaluateSocialMediaPlatformAuth(
      {
        serverVerified: true,
        servicePath: "/api/v1/content",
        correlationId: "corr-missing",
      },
      { now: NOW },
    );
    expect(missingClaims.allowed).toBe(false);
    expect(missingClaims.reason).toBe("PLATFORM_CLAIMS_REQUIRED");
    expect(missingClaims.evidence.outcome).toBe("DENY");
    expect(missingClaims.evidence.claims_snapshot).toBeUndefined();

    const malformed = evaluateSocialMediaPlatformAuth(
      {
        claimsParseError: "x-platform-claims must be valid JSON",
        serverVerified: true,
        servicePath: "/api/v1/content",
        correlationId: "corr-malformed",
      },
      { now: NOW },
    );
    expect(malformed.allowed).toBe(false);
    expect(malformed.reason).toBe("CLAIM_MALFORMED");

    const unverified = platformDecision(persona("analyst"), { serverVerified: false });
    expect(unverified.allowed).toBe(false);
    expect(unverified.reason).toBe("SERVER_VERIFICATION_REQUIRED");
    expect(unverified.evidence.server_verified).toBe(false);
    expect(unverified.evidence.claims_snapshot?.subject_id).toBe("user-analyst-001");
  });

  it("denies wrong module, jurisdiction, clearance, assignment, purpose, stale claim, and revoked session cases", () => {
    expect(platformDecision(persona("forensic-analyst")).reason).toBe("MODULE_DENIED");
    expect(platformDecision(withWrongJurisdiction(persona("analyst"))).reason).toBe("JURISDICTION_DENIED");
    expect(platformDecision(withClearance(persona("analyst"), "restricted")).reason).toBe("CLEARANCE_DENIED");
    expect(platformDecision(withoutQueueAssignment(persona("analyst"))).reason).toBe("ASSIGNMENT_DENIED");
    expect(platformDecision(withWrongPurpose(persona("analyst"))).reason).toBe("PURPOSE_DENIED");
    expect(platformDecision(withStaleIssueTime(persona("analyst"))).reason).toBe("CLAIM_STALE");

    const revokedClaim = persona("analyst");
    const revoked = evaluateSocialMediaPlatformAuth(
      {
        claims: revokedClaim,
        serverVerified: true,
        servicePath: "/api/v1/content",
        correlationId: "corr-revoked",
      },
      { now: NOW, revokedSessionIds: [revokedClaim.session_id] },
    );
    expect(revoked.allowed).toBe(false);
    expect(revoked.reason).toBe("PLATFORM_SESSION_REVOKED");
    expect(revoked.evidence.claims_snapshot?.session_id).toBe(revokedClaim.session_id);
  });

  it("does not let local/domain auth bypass platform decision evidence for platform-launched routes", async () => {
    const app = Fastify({ logger: false });
    app.addHook("preHandler", async (request) => {
      request.authUser = localAuthUser;
    });
    registerSocialMediaPlatformAuthMiddleware(app, { now: NOW });
    app.get("/api/v1/content", async (request) => ({
      ok: true,
      platformAuthOutcome: request.platformAuth?.outcome ?? "none",
    }));

    const platformWithoutClaims = await app.inject({
      method: "GET",
      url: "/api/v1/content",
      headers: { "x-platform-launch": "true" },
    });
    expect(platformWithoutClaims.statusCode).toBe(403);
    expect(JSON.parse(platformWithoutClaims.body).reason).toBe("PLATFORM_CLAIMS_REQUIRED");

    const directLocal = await app.inject({
      method: "GET",
      url: "/api/v1/content",
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
    registerSocialMediaPlatformAuthMiddleware(app, { now: NOW });
    app.get("/api/v1/content", async (request) => ({
      ok: true,
      platformAuthOutcome: request.platformAuth?.outcome ?? "none",
      gateEvidenceRef: request.platformAuth?.gate_evidence_ref ?? "none",
    }));

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/content",
      headers: {
        "x-platform-launch": "true",
        "x-platform-route": "social_media",
        "x-platform-claims": JSON.stringify(persona("analyst")),
        "x-platform-claims-verified": "true",
      },
    });
    const body = JSON.parse(response.body);
    expect(response.statusCode).toBe(200);
    expect(body.platformAuthOutcome).toBe("ALLOW");
    expect(body.gateEvidenceRef).toBe("P14-social-media-platform-auth-adapter");

    await app.close();
  });
});
