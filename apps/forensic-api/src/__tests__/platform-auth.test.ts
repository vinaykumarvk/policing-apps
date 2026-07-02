import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import type { AuthPayload } from "@puda/api-core";
import claimFixtures from "../../../../docs/spec/auth-claim-fixtures.json";
import type { ClearanceLevel, PlatformClaims } from "@policing-platform/authz";
import {
  evaluateForensicPlatformAuth,
  registerForensicPlatformAuthMiddleware,
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
  return evaluateForensicPlatformAuth(
    {
      claims: claim,
      serverVerified: overrides.serverVerified ?? true,
      servicePath: "/api/v1/evidence",
      correlationId: "corr-forensic-test",
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

function withoutEvidenceAssignment(claim: PlatformClaims): PlatformClaims {
  return {
    ...claim,
    assignment: {
      ...claim.assignment,
      evidence_ids: [],
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
  userId: "local-forensic-domain-user",
  userType: "ADMINISTRATOR",
  roles: ["ADMINISTRATOR"],
  jti: "local-forensic-jti",
  unitId: "digital-forensics",
};

describe("Forensic platform auth adapter", () => {
  afterEach(() => {
    delete process.env.FORENSIC_PLATFORM_REVOKED_SESSIONS;
  });

  it("allows a server-verified Forensic platform claim and records decision evidence", () => {
    const decision = platformDecision(persona("forensic-analyst"));

    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe("ALLOW");
    expect(decision.evidence.adapter_version).toBe("forensic-platform-auth-adapter.v1");
    expect(decision.evidence.gate_evidence_ref).toBe("P13-forensic-platform-auth-adapter");
    expect(decision.evidence.policy_version).toBe("platform.entitlements.v1");
    expect(decision.evidence.service_path).toBe("/api/v1/evidence");
    expect(decision.evidence.correlation_id).toBe("corr-forensic-test");
    expect(decision.evidence.source_version).toBe("forensic-api");
    expect(decision.evidence.projection_version).toBe("not_applicable");
    expect(decision.evidence.redaction_decision).toBe("metadata_only");
    expect(decision.evidence.server_verified).toBe(true);
    expect(decision.evidence.local_auth_required).toBe(true);
    expect(decision.evidence.claims_snapshot?.subject_id).toBe("user-forensic-001");
    expect(decision.evidence.claims_snapshot?.domain_permissions).toContainEqual({
      domain: "forensic",
      permissions: ["case:read", "evidence:metadata-read", "report:write"],
    });
  });

  it("denies missing, malformed, and unverified platform claims", () => {
    const missingClaims = evaluateForensicPlatformAuth(
      {
        serverVerified: true,
        servicePath: "/api/v1/evidence",
        correlationId: "corr-missing",
      },
      { now: NOW },
    );
    expect(missingClaims.allowed).toBe(false);
    expect(missingClaims.reason).toBe("PLATFORM_CLAIMS_REQUIRED");
    expect(missingClaims.evidence.outcome).toBe("DENY");
    expect(missingClaims.evidence.claims_snapshot).toBeUndefined();

    const malformed = evaluateForensicPlatformAuth(
      {
        claimsParseError: "x-platform-claims must be valid JSON",
        serverVerified: true,
        servicePath: "/api/v1/evidence",
        correlationId: "corr-malformed",
      },
      { now: NOW },
    );
    expect(malformed.allowed).toBe(false);
    expect(malformed.reason).toBe("CLAIM_MALFORMED");

    const unverified = platformDecision(persona("forensic-analyst"), { serverVerified: false });
    expect(unverified.allowed).toBe(false);
    expect(unverified.reason).toBe("SERVER_VERIFICATION_REQUIRED");
    expect(unverified.evidence.server_verified).toBe(false);
    expect(unverified.evidence.claims_snapshot?.subject_id).toBe("user-forensic-001");
  });

  it("denies wrong module, jurisdiction, clearance, assignment, stale claim, and revoked session cases", () => {
    expect(platformDecision(persona("desk-operator")).reason).toBe("MODULE_DENIED");
    expect(platformDecision(withJurisdiction(persona("forensic-analyst"), "Ludhiana")).reason).toBe("JURISDICTION_DENIED");
    expect(platformDecision(withClearance(persona("forensic-analyst"), "confidential")).reason).toBe("CLEARANCE_DENIED");
    expect(platformDecision(withoutEvidenceAssignment(persona("forensic-analyst"))).reason).toBe("ASSIGNMENT_DENIED");
    expect(platformDecision(withStaleIssueTime(persona("forensic-analyst"))).reason).toBe("CLAIM_STALE");

    const revokedClaim = persona("forensic-analyst");
    const revoked = evaluateForensicPlatformAuth(
      {
        claims: revokedClaim,
        serverVerified: true,
        servicePath: "/api/v1/evidence",
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
    registerForensicPlatformAuthMiddleware(app, { now: NOW });
    app.get("/api/v1/evidence", async (request) => ({
      ok: true,
      platformAuthOutcome: request.platformAuth?.outcome ?? "none",
    }));

    const platformWithoutClaims = await app.inject({
      method: "GET",
      url: "/api/v1/evidence",
      headers: { "x-platform-launch": "true" },
    });
    expect(platformWithoutClaims.statusCode).toBe(403);
    expect(JSON.parse(platformWithoutClaims.body).reason).toBe("PLATFORM_CLAIMS_REQUIRED");

    const directLocal = await app.inject({
      method: "GET",
      url: "/api/v1/evidence",
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
    registerForensicPlatformAuthMiddleware(app, { now: NOW });
    app.get("/api/v1/evidence", async (request) => ({
      ok: true,
      platformAuthOutcome: request.platformAuth?.outcome ?? "none",
      gateEvidenceRef: request.platformAuth?.gate_evidence_ref ?? "none",
    }));

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/evidence",
      headers: {
        "x-platform-launch": "true",
        "x-platform-route": "forensic",
        "x-platform-claims": JSON.stringify(persona("forensic-analyst")),
        "x-platform-claims-verified": "true",
      },
    });
    const body = JSON.parse(response.body);
    expect(response.statusCode).toBe(200);
    expect(body.platformAuthOutcome).toBe("ALLOW");
    expect(body.gateEvidenceRef).toBe("P13-forensic-platform-auth-adapter");

    await app.close();
  });
});
