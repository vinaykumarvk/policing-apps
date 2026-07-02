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

export interface PlatformUserSummary {
  userId: string;
  username: string;
  displayName: string;
  persona: string;
  orgId: string;
  status: "active" | "disabled";
}

export interface IdentityAdminStore extends IdentityStore {
  listUsers: () => Promise<readonly PlatformUserSummary[]>;
  createUser: (user: PlatformUser, entitlements: readonly UserEntitlement[]) => Promise<void>;
  setUserStatus: (userId: string, status: "active" | "disabled") => Promise<boolean>;
  setPasswordHash: (userId: string, passwordHash: string) => Promise<boolean>;
  setTotpSecret: (userId: string, totpSecret: string) => Promise<boolean>;
}

export interface MintClaimsInput {
  user: PlatformUser;
  entitlements: readonly UserEntitlement[];
  sessionId: string;
  mfaVerifiedAt: string;
  /** How the session authenticated; recorded verbatim in mfa.methods. */
  authMethod?: "totp" | "password";
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
      methods: [input.authMethod ?? "totp"],
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
): IdentityAdminStore {
  const userList: PlatformUser[] = users.map((user) => ({ ...user }));
  const entitlementMap = new Map<string, readonly UserEntitlement[]>(Object.entries(entitlements));

  const find = (userId: string) => userList.find((user) => user.userId === userId);

  return {
    getUserByUsername: async (username) =>
      userList.find((user) => user.username === username) ?? null,
    getUserById: async (userId) => find(userId) ?? null,
    getEntitlements: async (userId) => entitlementMap.get(userId) ?? [],
    listUsers: async () =>
      userList.map((user) => ({
        userId: user.userId,
        username: user.username,
        displayName: user.displayName,
        persona: user.persona,
        orgId: user.orgId,
        status: user.status,
      })),
    createUser: async (user, userEntitlements) => {
      if (userList.some((existing) => existing.username === user.username)) {
        throw new Error("USERNAME_TAKEN");
      }
      userList.push({ ...user });
      entitlementMap.set(user.userId, [...userEntitlements]);
    },
    setUserStatus: async (userId, status) => {
      const user = find(userId);
      if (!user) {
        return false;
      }
      user.status = status;
      return true;
    },
    setPasswordHash: async (userId, passwordHash) => {
      const user = find(userId);
      if (!user) {
        return false;
      }
      user.passwordHash = passwordHash;
      return true;
    },
    setTotpSecret: async (userId, totpSecret) => {
      const user = find(userId);
      if (!user) {
        return false;
      }
      user.totpSecret = totpSecret;
      return true;
    },
  };
}
