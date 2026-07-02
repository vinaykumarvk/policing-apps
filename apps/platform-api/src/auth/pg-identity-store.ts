// Postgres-backed identity store (platform.platform_user / platform_user_entitlement).
import { Pool } from "pg";
import type { AssignmentClaim, ClearanceClaim, JurisdictionClaim } from "../../../../packages/authz/src";
import type {
  IdentityAdminStore,
  PlatformUser,
  PlatformUserSummary,
  UserEntitlement,
} from "./identity";

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

export function createPgIdentityStore(pool: Pool): IdentityAdminStore {
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
    listUsers: async () => {
      const result = await pool.query<{
        user_id: string;
        username: string;
        display_name: string;
        persona: string;
        org_id: string;
        status: "active" | "disabled";
      }>(
        `SELECT user_id, username, display_name, persona, org_id, status
           FROM platform.platform_user ORDER BY username`,
      );
      return result.rows.map(
        (row): PlatformUserSummary => ({
          userId: row.user_id,
          username: row.username,
          displayName: row.display_name,
          persona: row.persona,
          orgId: row.org_id,
          status: row.status,
        }),
      );
    },
    createUser: async (user, entitlements) => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          `INSERT INTO platform.platform_user
             (user_id, username, password_hash, totp_secret, display_name, persona,
              tenant_id, org_id, unit_ids, org_scope, jurisdiction, clearance,
              assignment, purpose_allowed, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
          [
            user.userId,
            user.username,
            user.passwordHash,
            user.totpSecret,
            user.displayName,
            user.persona,
            user.tenantId,
            user.orgId,
            [...user.unitIds],
            user.orgScope,
            JSON.stringify(user.jurisdiction),
            JSON.stringify(user.clearance),
            JSON.stringify(user.assignment),
            [...user.purposeAllowed],
            user.status,
          ],
        );
        for (const entitlement of entitlements) {
          await client.query(
            `INSERT INTO platform.platform_user_entitlement (user_id, module, domain, permissions)
             VALUES ($1, $2, $3, $4)`,
            [user.userId, entitlement.module, entitlement.domain, [...entitlement.permissions]],
          );
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        if (error instanceof Error && /platform_user_username_key|duplicate key/.test(error.message)) {
          throw new Error("USERNAME_TAKEN");
        }
        throw error;
      } finally {
        client.release();
      }
    },
    setUserStatus: async (userId, status) => {
      const result = await pool.query(
        "UPDATE platform.platform_user SET status = $2, updated_at = now() WHERE user_id = $1",
        [userId, status],
      );
      return (result.rowCount ?? 0) > 0;
    },
    setPasswordHash: async (userId, passwordHash) => {
      const result = await pool.query(
        "UPDATE platform.platform_user SET password_hash = $2, updated_at = now() WHERE user_id = $1",
        [userId, passwordHash],
      );
      return (result.rowCount ?? 0) > 0;
    },
    setTotpSecret: async (userId, totpSecret) => {
      const result = await pool.query(
        "UPDATE platform.platform_user SET totp_secret = $2, updated_at = now() WHERE user_id = $1",
        [userId, totpSecret],
      );
      return (result.rowCount ?? 0) > 0;
    },
  };
}
