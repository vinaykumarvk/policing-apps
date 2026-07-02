// Identity store contract and platform-claims minting for the claims issuer.
// Claims are minted fresh per request (validatePlatformClaims enforces a
// 15-minute max age) and must always pass the shared authz validator.
import {
  validatePlatformClaims,
  type AssignmentClaim,
  type ClearanceClaim,
  type DomainPermissionClaim,
  type JurisdictionClaim,
  type PlatformClaims,
} from "../../../../packages/authz/src";

export const PLATFORM_IDP_SOURCE = "platform-idp";
// Matches the expectedSourceVersion already enforced by the deployed platform
// app and domain adapters. Bump alongside docs/spec/auth-entitlements-contract.md.
export const PLATFORM_IDP_SOURCE_VERSION = "idp-seed-v1";

export interface PlatformUser {
  userId: string;
  username: string;
  passwordHash: string;
  totpSecret: string;
  displayName: string;
  persona: string;
  tenantId: string;
  orgId: string;
  unitIds: readonly string[];
  orgScope: string;
  jurisdiction: JurisdictionClaim;
  clearance: ClearanceClaim;
  assignment: AssignmentClaim;
  purposeAllowed: readonly string[];
  status: "active" | "disabled";
}

export interface UserEntitlement {
  module: string;
  domain: string;
  permissions: readonly string[];
}

export interface IdentityStore {
  getUserByUsername: (username: string) => Promise<PlatformUser | null>;
  getUserById: (userId: string) => Promise<PlatformUser | null>;
  getEntitlements: (userId: string) => Promise<readonly UserEntitlement[]>;
}

export interface MintClaimsInput {
  user: PlatformUser;
  entitlements: readonly UserEntitlement[];
  sessionId: string;
  mfaVerifiedAt: string;
  now: Date;
  ttlSeconds?: number;
}

export function mintPlatformClaims(input: MintClaimsInput): PlatformClaims {
  const { user, entitlements, sessionId, now } = input;
  const ttlSeconds = input.ttlSeconds ?? 10 * 60;
  const domainPermissions: DomainPermissionClaim[] = entitlements.map((entitlement) => ({
    domain: entitlement.domain,
    permissions: [...entitlement.permissions],
  }));
  const modules = [...new Set(entitlements.map((entitlement) => entitlement.module))];

  const claims: PlatformClaims = {
    schema_version: "platform.claims.v1",
    claim_version: 1,
    source: PLATFORM_IDP_SOURCE,
    source_version: PLATFORM_IDP_SOURCE_VERSION,
    subject: {
      user_id: user.userId,
      persona: user.persona,
      display_name: user.displayName,
      tenant_id: user.tenantId,
      org_id: user.orgId,
    },
    issued_at: now.toISOString(),
    expires_at: new Date(now.getTime() + ttlSeconds * 1000).toISOString(),
    session_id: sessionId,
    modules,
    domain_permissions: domainPermissions,
    org: {
      tenant_id: user.tenantId,
      org_id: user.orgId,
      unit_ids: [...user.unitIds],
      scope: user.orgScope,
    },
    jurisdiction: user.jurisdiction,
    clearance: user.clearance,
    assignment: user.assignment,
    purpose: { allowed: [...user.purposeAllowed] },
    mfa: {
      required: true,
      verified: true,
      methods: ["totp"],
      verified_at: input.mfaVerifiedAt,
    },
  };

  const validation = validatePlatformClaims(claims, { now });
  if (!validation.valid) {
    throw new Error(`minted claims failed validation: ${validation.reason}`);
  }
  return claims;
}

export function createInMemoryIdentityStore(
  users: readonly PlatformUser[],
  entitlements: Readonly<Record<string, readonly UserEntitlement[]>>,
): IdentityStore {
  return {
    getUserByUsername: async (username) =>
      users.find((user) => user.username === username) ?? null,
    getUserById: async (userId) => users.find((user) => user.userId === userId) ?? null,
    getEntitlements: async (userId) => entitlements[userId] ?? [],
  };
}
