/**
 * Migration runner for Forensic API.
 * Runs all SQL files in migrations/ directory in alphabetical order.
 * Run: npx tsx scripts/migrate.ts
 */
import { promises as fs } from "fs";
import path from "path";
import { query, pool } from "../src/db";

const MIGRATIONS_DIR = path.resolve(__dirname, "..", "migrations");

async function migrate() {
  console.log("[MIGRATE] Starting Forensic API migrations...");

  // Ensure migrations tracking table exists
  await query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  const files = await fs.readdir(MIGRATIONS_DIR);
  const sqlFiles = files.filter((f) => f.endsWith(".sql")).sort();

  // Get already applied migrations
  const applied = await query(`SELECT filename FROM _migrations`);
  const appliedSet = new Set(applied.rows.map((r: { filename: string }) => r.filename));

  let count = 0;
  for (const file of sqlFiles) {
    if (appliedSet.has(file)) {
      console.log(`[MIGRATE] Already applied: ${file}`);
      continue;
    }
    const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), "utf-8");
    await query(sql);
    await query(`INSERT INTO _migrations (filename) VALUES ($1)`, [file]);
    console.log(`[MIGRATE] Applied: ${file}`);
    count++;
  }

  console.log(`[MIGRATE] Done. Applied ${count} new migration(s).`);
}

migrate()
  .catch((err) => { console.error("[MIGRATE] Fatal error:", err); process.exit(1); })
  .finally(() => pool.end());
