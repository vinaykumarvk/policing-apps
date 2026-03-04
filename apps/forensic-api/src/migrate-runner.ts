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

  let count = 0;
  for (const file of sqlFiles) {
    if (appliedSet.has(file)) continue;
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
