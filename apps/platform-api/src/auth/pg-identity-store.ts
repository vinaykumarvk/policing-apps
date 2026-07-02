// Postgres-backed identity store (platform.platform_user / platform_user_entitlement).
import { Pool } from "pg";
import type { AssignmentClaim, ClearanceClaim, JurisdictionClaim } from "../../../../packages/authz/src";
import type { IdentityStore, PlatformUser, UserEntitlement } from "./identity";

const USER_COLUMNS = `
  user_id, username, password_hash, totp_secret, display_name, persona,
  tenant_id, org_id, unit_ids, org_scope, jurisdiction, clearance, assignment,
  purpose_allowed, status
`;

interface UserRow {
  user_id: string;
  username: string;
  password_hash: string;
  totp_secret: string;
  display_name: string;
  persona: string;
  tenant_id: string;
  org_id: string;
  unit_ids: string[];
  org_scope: string;
  jurisdiction: JurisdictionClaim;
  clearance: ClearanceClaim;
  assignment: AssignmentClaim;
  purpose_allowed: string[];
  status: "active" | "disabled";
}

function rowToUser(row: UserRow): PlatformUser {
  return {
    userId: row.user_id,
    username: row.username,
    passwordHash: row.password_hash,
    totpSecret: row.totp_secret,
    displayName: row.display_name,
    persona: row.persona,
    tenantId: row.tenant_id,
    orgId: row.org_id,
    unitIds: row.unit_ids,
    orgScope: row.org_scope,
    jurisdiction: row.jurisdiction,
    clearance: row.clearance,
    assignment: row.assignment,
    purposeAllowed: row.purpose_allowed,
    status: row.status,
  };
}

export function createPgIdentityStore(pool: Pool): IdentityStore {
  return {
    getUserByUsername: async (username) => {
      const result = await pool.query<UserRow>(
        `SELECT ${USER_COLUMNS} FROM platform.platform_user WHERE username = $1`,
        [username],
      );
      return result.rows[0] ? rowToUser(result.rows[0]) : null;
    },
    getUserById: async (userId) => {
      const result = await pool.query<UserRow>(
        `SELECT ${USER_COLUMNS} FROM platform.platform_user WHERE user_id = $1`,
        [userId],
      );
      return result.rows[0] ? rowToUser(result.rows[0]) : null;
    },
    getEntitlements: async (userId) => {
      const result = await pool.query<{ module: string; domain: string; permissions: string[] }>(
        `SELECT module, domain, permissions
           FROM platform.platform_user_entitlement
          WHERE user_id = $1
          ORDER BY module, domain`,
        [userId],
      );
      return result.rows.map(
        (row): UserEntitlement => ({
          module: row.module,
          domain: row.domain,
          permissions: row.permissions,
        }),
      );
    },
  };
}
