import pg from "pg";
import fs from "fs";
import dotenv from "dotenv";
import path from "path";
import { logWarn } from "./logger";

dotenv.config({ path: path.resolve(__dirname, "..", "..", "..", ".env") });

const { Pool } = pg;
const isTestRuntime = process.env.NODE_ENV === "test" || process.env.VITEST === "true";

const connectionString = process.env.FORENSIC_DATABASE_URL || process.env.DATABASE_URL;
const resolvedConnectionString =
  connectionString || (isTestRuntime ? "postgres://puda:puda@localhost:5432/forensic" : undefined);
if (!resolvedConnectionString && !isTestRuntime) {
  throw new Error("FATAL: FORENSIC_DATABASE_URL must be set in non-test runtime");
}

function resolveSslConfig(): any {
  const sslEnv = process.env.DATABASE_SSL;
  if (sslEnv === "false") {
    if (process.env.NODE_ENV === "production") {
      throw new Error("FATAL: DATABASE_SSL=false is not allowed in production");
    }
    return undefined;
  }
  const ca = process.env.DATABASE_SSL_CA_BASE64
    ? Buffer.from(process.env.DATABASE_SSL_CA_BASE64, "base64").toString("utf-8")
    : process.env.DATABASE_SSL_CA_PATH
      ? fs.readFileSync(process.env.DATABASE_SSL_CA_PATH, "utf-8")
      : process.env.DATABASE_SSL_CA || undefined;
  return { rejectUnauthorized: true, ...(ca ? { ca } : {}) };
}

export const pool = new pg.Pool({
  connectionString: resolvedConnectionString || "postgres://puda:puda@localhost:5432/forensic",
  max: Number.parseInt(process.env.PG_POOL_MAX || "20", 10) || 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: resolveSslConfig(),
});

// Periodic pool metrics (every 30s)
if (!isTestRuntime) {
  setInterval(() => {
    logWarn("DB_POOL_METRICS", {
      totalClients: pool.totalCount,
      idleClients: pool.idleCount,
      waitingClients: pool.waitingCount,
    });
  }, 30_000).unref();
}

export async function query(text: string, params?: any[]) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (duration > 500) {
    logWarn("SLOW_QUERY", { text: text.slice(0, 120), durationMs: duration });
  }
  return res;
}

export async function getClient() {
  return await pool.connect();
}
