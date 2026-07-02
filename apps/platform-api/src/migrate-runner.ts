// Applies platform migrations in order, then bootstraps the initial admin user
// when the user table is empty. Bootstrap credentials arrive via environment
// (Secret Manager in cloud) and are never logged.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { hashPassword } from "./auth/crypto";

function migrationsDir(): string {
  // Compiled layout: dist/apps/platform-api/src/migrate-runner.js with SQL at
  // dist/apps/platform-api/src/migrations (copied by the Docker build).
  return process.env.MIGRATIONS_DIR ?? join(__dirname, "migrations");
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.log("migrate-runner: DATABASE_URL not set, skipping migrations");
    return;
  }
  const pool = new Pool({ connectionString: databaseUrl, max: 2 });
  try {
    await pool.query("CREATE SCHEMA IF NOT EXISTS platform");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS platform.schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const dir = migrationsDir();
    const files = readdirSync(dir)
      .filter((file) => file.endsWith(".sql"))
      .sort();
    for (const file of files) {
      const applied = await pool.query("SELECT 1 FROM platform.schema_migrations WHERE filename = $1", [
        file,
      ]);
      if (applied.rowCount) {
        continue;
      }
      const sql = readFileSync(join(dir, file), "utf8");
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("INSERT INTO platform.schema_migrations (filename) VALUES ($1)", [file]);
        await client.query("COMMIT");
        console.log(`migrate-runner: applied ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }

    await bootstrapAdmin(pool);
  } finally {
    await pool.end();
  }
}

async function bootstrapAdmin(pool: Pool): Promise<void> {
  const password = process.env.PLATFORM_ADMIN_BOOTSTRAP_PASSWORD;
  const totpSecret = process.env.PLATFORM_ADMIN_TOTP_SECRET;
  if (!password || !totpSecret) {
    return;
  }
  const existing = await pool.query("SELECT 1 FROM platform.platform_user LIMIT 1");
  if (existing.rowCount) {
    return;
  }

  const userId = `user-${randomUUID()}`;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO platform.platform_user
         (user_id, username, password_hash, totp_secret, display_name, persona,
          tenant_id, org_id, unit_ids, org_scope, jurisdiction, clearance,
          assignment, purpose_allowed, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'active')`,
      [
        userId,
        process.env.PLATFORM_ADMIN_USERNAME ?? "platform-admin",
        hashPassword(password),
        totpSecret,
        "Platform Administrator",
        "platform_admin",
        "punjab-police",
        // Pilot-fixture org/assignment context: the registry entitlement
        // requests pin these values, so the bootstrap admin can exercise the
        // dopams/iqw pilot flows. Real users get their own org rows later.
        "mohali-district",
        ["narcotics-cell-mohali", "desk-mohali", "platform-administration"],
        "unit",
        JSON.stringify({
          country: "IN",
          state: "PB",
          districts: ["SAS Nagar"],
          police_stations: ["Phase-8"],
          scope: "station",
        }),
        JSON.stringify({ level: "secret", compartments: ["platform_admin", "casework", "intelligence"] }),
        JSON.stringify({
          case_ids: ["CASE-DOPAMS-001"],
          queue_ids: ["desk-mohali-intake"],
          evidence_ids: ["EVID-DOPAMS-001"],
          jurisdiction_wide: false,
          domain_wide: false,
        }),
        ["investigation", "complaint_intake", "case_review", "intelligence_analysis"],
      ],
    );
    const entitlements: Array<[string, string, string[]]> = [
      ["platform_admin", "platform", ["registry:read", "health:read"]],
      ["dopams", "dopams", ["case:read", "evidence:metadata-read"]],
      ["iqw", "iqw", ["complaint:read", "task:queue-read"]],
      ["forensic", "forensic", ["evidence:metadata-read"]],
      ["social_media", "social_media", ["content:metadata-read", "trend:read"]],
      ["knowledge", "knowledge", ["query:case-summary"]],
    ];
    for (const [module, domain, permissions] of entitlements) {
      await client.query(
        `INSERT INTO platform.platform_user_entitlement (user_id, module, domain, permissions)
         VALUES ($1, $2, $3, $4)`,
        [userId, module, domain, permissions],
      );
    }
    await client.query("COMMIT");
    console.log("migrate-runner: bootstrapped initial admin user");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

main().catch((error) => {
  console.error("migrate-runner: failed", error instanceof Error ? error.message : error);
  process.exit(1);
});
