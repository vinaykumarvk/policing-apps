/**
 * Seed script for Social Media API.
 * Run: npx tsx scripts/seed.ts (from apps/social-media-api)
 */
import { query, pool } from "../src/db";
import { hashPassword } from "../src/auth";

async function seed() {
  console.log("[SEED] Starting Social Media API seed...");

  // 1. Organization units
  const units = [
    { name: "Headquarters", unitType: "HQ" },
    { name: "District 1", unitType: "DISTRICT" },
    { name: "District 2", unitType: "DISTRICT" },
  ];
  for (const u of units) {
    await query(
      `INSERT INTO organization_unit (unit_id, name, unit_type, is_active)
       VALUES (gen_random_uuid(), $1, $2, true)
       ON CONFLICT DO NOTHING`,
      [u.name, u.unitType],
    );
  }
  console.log("[SEED] Organization units created");

  // 2. Roles (use existing roles from init migration, ensure they exist)
  const roles = ["INTELLIGENCE_ANALYST", "CONTROL_ROOM_OPERATOR", "SUPERVISOR", "INVESTIGATOR", "LEGAL_REVIEWER", "EVIDENCE_CUSTODIAN", "PLATFORM_ADMINISTRATOR"];
  for (const rk of roles) {
    await query(
      `INSERT INTO role (role_id, role_key, display_name, description)
       VALUES (gen_random_uuid(), $1, $2, $3)
       ON CONFLICT (role_key) DO NOTHING`,
      [rk, rk, rk],
    );
  }
  console.log("[SEED] Roles ensured");

  // Get HQ unit_id
  const hqResult = await query(`SELECT unit_id FROM organization_unit WHERE name = 'Headquarters' LIMIT 1`);
  const hqUnitId = hqResult.rows[0]?.unit_id || null;

  // 3. Users
  const users = [
    { username: "admin", password: "password", fullName: "Admin User", userType: "OFFICER", roleMappings: ["PLATFORM_ADMINISTRATOR"] },
    { username: "analyst1", password: "password", fullName: "Analyst One", userType: "OFFICER", roleMappings: ["INTELLIGENCE_ANALYST"] },
    { username: "supervisor1", password: "password", fullName: "Supervisor One", userType: "OFFICER", roleMappings: ["SUPERVISOR"] },
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

  // 4. Source connectors
  for (const c of [
    { platform: "reddit", type: "Polling" },
    { platform: "youtube", type: "Polling" },
    { platform: "twitter", type: "Polling" },
    { platform: "instagram", type: "Polling" },
    { platform: "facebook", type: "Polling" },
    { platform: "apify", type: "Polling" },
  ]) {
    await query(
      `INSERT INTO source_connector (platform, connector_type, config_jsonb, is_active)
       SELECT $1::varchar, $2::varchar, '{}'::jsonb, true
       WHERE NOT EXISTS (SELECT 1 FROM source_connector WHERE platform = $1::varchar)`,
      [c.platform, c.type],
    );
  }
  console.log("[SEED] Source connectors ensured");

  // 5. Sample watchlist
  await query(
    `INSERT INTO watchlist (name, description, keywords, platforms, is_active, created_by)
     SELECT $1::varchar, $2::text, $3::jsonb, $4::jsonb, true, (SELECT user_id FROM user_account WHERE username = 'admin' LIMIT 1)
     WHERE NOT EXISTS (SELECT 1 FROM watchlist WHERE name = $1::varchar)`,
    [
      "Default Monitoring",
      "Default watchlist for initial monitoring",
      JSON.stringify(["cyber crime india", "online fraud", "social media threat"]),
      JSON.stringify(["reddit", "youtube", "twitter", "instagram", "facebook"]),
    ],
  );
  console.log("[SEED] Default watchlist ensured");

  console.log("[SEED] Social Media API seed complete!");
}

seed()
  .catch((err) => { console.error("[SEED] Fatal error:", err); process.exit(1); })
  .finally(() => pool.end());
