import { describe, expect, it } from "vitest";
import fixtures from "../../../../docs/spec/auth-claim-fixtures.json";
import {
  PLATFORM_CLAIMS_SCHEMA_VERSION,
  type PlatformClaims,
  claimEvidenceSnapshot,
  validatePlatformClaims,
} from "../claims";

interface ClaimFixture {
  id: string;
  label: string;
  claim: PlatformClaims;
}

interface AuthClaimFixtures {
  claim_schema_version: string;
  personas: ClaimFixture[];
}

const NOW = "2026-07-01T18:45:00Z";
const typedFixtures = fixtures as AuthClaimFixtures;

function persona(id: string): PlatformClaims {
  const found = typedFixtures.personas.find((entry) => entry.id === id);
  if (!found) {
    throw new Error(`missing fixture persona ${id}`);
  }
  return found.claim;
}

function cloneClaim(claim: PlatformClaims): PlatformClaims {
  return JSON.parse(JSON.stringify(claim)) as PlatformClaims;
}

describe("platform claim validation", () => {
  it("keeps fixtures on the canonical schema version", () => {
    expect(typedFixtures.claim_schema_version).toBe(PLATFORM_CLAIMS_SCHEMA_VERSION);
  });

  it("validates every required seed persona", () => {
    const expectedPersonas = [
      "desk-operator",
      "io",
      "analyst",
      "forensic-analyst",
      "supervisor",
      "legal-reviewer",
      "admin",
      "auditor",
    ];

    expect(typedFixtures.personas.map((entry) => entry.id).sort()).toEqual(expectedPersonas.sort());

    typedFixtures.personas.forEach((entry) => {
      const result = validatePlatformClaims(entry.claim, { now: NOW, expectedSourceVersion: "idp-seed-v1" });
      expect(result.valid, entry.id).toBe(true);
    });
  });

  it("denies unsupported schema versions", () => {
    const claim = cloneClaim(persona("io"));
    claim.schema_version = "platform.claims.v99";

    const result = validatePlatformClaims(claim, { now: NOW });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("CLAIM_UNSUPPORTED_VERSION");
    }
  });

  it("denies expired and stale claims", () => {
    const expired = cloneClaim(persona("io"));
    expired.expires_at = "2026-07-01T18:31:00Z";
    const expiredResult = validatePlatformClaims(expired, { now: NOW });
    expect(expiredResult.valid).toBe(false);
    if (!expiredResult.valid) {
      expect(expiredResult.reason).toBe("CLAIM_EXPIRED");
    }

    const staleResult = validatePlatformClaims(persona("io"), {
      now: "2026-07-01T19:00:01Z",
      maxAgeSeconds: 60,
    });
    expect(staleResult.valid).toBe(false);
    if (!staleResult.valid) {
      expect(staleResult.reason).toBe("CLAIM_STALE");
    }
  });

  it("denies ambiguous duplicate claim dimensions", () => {
    const claim = cloneClaim(persona("io"));
    claim.domain_permissions = [
      { domain: "dopams", permissions: ["case:read"] },
      { domain: "dopams", permissions: ["case:update"] },
    ];

    const result = validatePlatformClaims(claim, { now: NOW });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("CLAIM_AMBIGUOUS");
    }
  });

  it("produces a versioned decision-evidence snapshot", () => {
    const result = validatePlatformClaims(persona("forensic-analyst"), { now: NOW });
    expect(result.valid).toBe(true);
    if (result.valid) {
      const snapshot = claimEvidenceSnapshot(result.claims);
      expect(snapshot.schema_version).toBe(PLATFORM_CLAIMS_SCHEMA_VERSION);
      expect(snapshot.source_version).toBe("idp-seed-v1");
      expect(snapshot.modules).toContain("forensic");
      expect(snapshot.jurisdiction.scope).toBe("district");
      expect(snapshot.clearance.level).toBe("secret");
      expect(snapshot.assignment.evidence_ids).toContain("EVID-DOPAMS-001");
      expect(snapshot.purpose.allowed).toContain("forensic_review");
      expect(snapshot.mfa_verified).toBe(true);
    }
  });
});
