/**
 * Compiled migration runner for production Docker images.
 * Runs all SQL files in migrations/ directory in alphabetical order.
 * Usage: node dist/migrate-runner.js
 */
import { promises as fs } from "fs";
import path from "path";
import { query, pool } from "./db";

const MIGRATIONS_DIR = path.resolve(__dirname, "..", "migrations");

async function migrate() {
  console.log("[MIGRATE] Starting Forensic API migrations...");

  await query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  const files = await fs.readdir(MIGRATIONS_DIR);
  const sqlFiles = files.filter((f) => f.endsWith(".sql")).sort();

  const applied = await query(`SELECT filename FROM _migrations`);
  const appliedSet = new Set(applied.rows.map((r: { filename: string }) => r.filename));

  // PG error codes that indicate the migration's DDL already exists in the DB.
  // This happens on first run against a DB where tables were created outside
  // the migration runner. We treat these as "already applied".
  const ALREADY_EXISTS_CODES = new Set([
    "42P07", // duplicate_table
    "42701", // duplicate_column
    "42710", // duplicate_object
    "42P16", // invalid_table_definition (e.g. column already exists in ADD COLUMN)
  ]);

  let count = 0;
  for (const file of sqlFiles) {
    if (appliedSet.has(file)) continue;
    const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), "utf-8");
    try {
      await query(sql);
      console.log(`[MIGRATE] Applied: ${file}`);
    } catch (err: any) {
      if (ALREADY_EXISTS_CODES.has(err?.code)) {
        console.log(`[MIGRATE] Skipped (already exists): ${file} — ${err.message}`);
      } else {
        throw err;
      }
    }
    await query(`INSERT INTO _migrations (filename) VALUES ($1)`, [file]);
    count++;
  }

  console.log(`[MIGRATE] Done. Applied ${count} new migration(s).`);
}

migrate()
  .catch((err) => { console.error("[MIGRATE] Fatal error:", err); process.exit(1); })
  .finally(() => pool.end());
