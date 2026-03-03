import pg from "pg";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "..", "..", "..", ".env") });

const { Pool } = pg;
const isTestRuntime = process.env.NODE_ENV === "test" || process.env.VITEST === "true";

const connectionString = process.env.SM_DATABASE_URL || process.env.DATABASE_URL;
const resolvedConnectionString =
  connectionString || (isTestRuntime ? "postgres://puda:puda@localhost:5432/social_media" : undefined);
if (!resolvedConnectionString && !isTestRuntime) {
  throw new Error("FATAL: SM_DATABASE_URL must be set in non-test runtime");
}

export const pool = new pg.Pool({
  connectionString: resolvedConnectionString || "postgres://puda:puda@localhost:5432/social_media",
  max: 8,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export async function query(text: string, params?: any[]) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (duration > 500) {
    console.warn(JSON.stringify({ level: "warn", message: "SLOW_QUERY", text: text.slice(0, 120), durationMs: duration }));
  }
  return res;
}

export async function getClient() {
  return await pool.connect();
}
