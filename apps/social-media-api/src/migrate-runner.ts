/**
 * Compiled migration runner for production Docker images.
 * Runs all SQL files in migrations/ directory in alphabetical order.
 *
 * Handles "first run on existing DB" gracefully: if _migrations is empty but
 * the DB already has tables, migrations that fail are assumed to be already
 * applied and are skipped (logged as warnings).
 *
 * Usage: node dist/migrate-runner.js
 */
import { promises as fs } from "fs";
import path from "path";
import { query, pool } from "./db";

const MIGRATIONS_DIR = path.resolve(__dirname, "..", "migrations");

async function migrate() {
  console.log("[MIGRATE] Starting Social Media API migrations...");

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

  // Detect if this is the first run on an existing DB (tables exist but no
  // migration records). In this mode we tolerate migration errors because the
  // DDL was applied outside the runner.
  const isFirstRunOnExistingDb = appliedSet.size === 0 && (await dbHasTables());
  if (isFirstRunOnExistingDb) {
    console.log("[MIGRATE] First run on existing DB detected — will skip failing migrations.");
  }

  let count = 0;
  let skipped = 0;
  for (const file of sqlFiles) {
    if (appliedSet.has(file)) continue;
    const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), "utf-8");
    try {
      await query(sql);
      console.log(`[MIGRATE] Applied: ${file}`);
    } catch (err: any) {
      if (isFirstRunOnExistingDb) {
        console.log(`[MIGRATE] Skipped (existing DB): ${file} — ${err.message}`);
        // Reset any aborted transaction state so subsequent queries work.
        await query("ROLLBACK").catch(() => {});
        skipped++;
      } else {
        throw err;
      }
    }
    await query(`INSERT INTO _migrations (filename) VALUES ($1)`, [file]);
    count++;
  }

  console.log(`[MIGRATE] Done. Processed ${count} migration(s)${skipped ? `, ${skipped} skipped (existing DB)` : ""}.`);
}

async function dbHasTables(): Promise<boolean> {
  const result = await query(`
    SELECT count(*)::int AS n FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      AND table_name != '_migrations'
  `);
  return result.rows[0].n > 0;
}

migrate()
  .catch((err) => { console.error("[MIGRATE] Fatal error:", err); process.exit(1); })
  .finally(() => pool.end());
