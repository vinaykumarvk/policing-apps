/**
 * Seed script for DOPAMS API.
 * Run: npx tsx scripts/seed.ts (from apps/dopams-api)
 */
import { query, pool } from "../src/db";
import { hashPassword } from "../src/auth";

async function seed() {
  console.log("[SEED] Starting DOPAMS API seed...");

  // 1. Organization units
  const units = [
    { name: "Headquarters", code: "HQ" },
    { name: "District 1", code: "DIST-1" },
    { name: "District 2", code: "DIST-2" },
  ];
  for (const u of units) {
    await query(
      `INSERT INTO organization_unit (unit_id, name, code, is_active)
       VALUES (gen_random_uuid(), $1, $2, true)
       ON CONFLICT (code) DO NOTHING`,
      [u.name, u.code],
    );
  }
  console.log("[SEED] Organization units created");

  // 2. Roles (use existing roles from init migration, ensure they exist)
  const roles = ["DISTRICT_OPERATOR", "TOLL_FREE_OPERATOR", "INTELLIGENCE_ANALYST", "SUPERVISORY_OFFICER", "ZONAL_OFFICER", "INVESTIGATING_OFFICER", "ADMINISTRATOR"];
  for (const rk of roles) {
    await query(
      `INSERT INTO role (role_id, role_key, description)
       VALUES (gen_random_uuid(), $1, $1)
       ON CONFLICT (role_key) DO NOTHING`,
      [rk],
    );
  }
  console.log("[SEED] Roles ensured");

  // Get HQ unit_id
  const hqResult = await query(`SELECT unit_id FROM organization_unit WHERE code = 'HQ' LIMIT 1`);
  const hqUnitId = hqResult.rows[0]?.unit_id || null;

  // 3. Users
  const users = [
    { username: "admin", password: "password", fullName: "Admin User", userType: "OFFICER", roleMappings: ["ADMINISTRATOR"] },
    { username: "officer1", password: "password", fullName: "Officer One", userType: "OFFICER", roleMappings: ["INVESTIGATING_OFFICER"] },
    { username: "supervisor1", password: "password", fullName: "Supervisor One", userType: "OFFICER", roleMappings: ["SUPERVISORY_OFFICER"] },
  ];

  for (const u of users) {
    const hash = await hashPassword(u.password);
    const result = await query(
      `INSERT INTO user_account (user_id, username, password_hash, full_name, user_type, unit_id, is_active)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, true)
       ON CONFLICT (username) DO NOTHING
       RETURNING user_id`,
      [u.username, hash, u.fullName, u.userType, hqUnitId],
    );

    if (result.rows.length > 0) {
      const userId = result.rows[0].user_id;
      for (const roleKey of u.roleMappings) {
        await query(
          `INSERT INTO user_role (user_id, role_id)
           SELECT $1, role_id FROM role WHERE role_key = $2
           ON CONFLICT DO NOTHING`,
          [userId, roleKey],
        );
      }
      console.log(`[SEED] Created user: ${u.username}`);
    } else {
      console.log(`[SEED] User already exists: ${u.username}`);
    }
  }

  console.log("[SEED] DOPAMS API seed complete!");
}

seed()
  .catch((err) => { console.error("[SEED] Fatal error:", err); process.exit(1); })
  .finally(() => pool.end());
