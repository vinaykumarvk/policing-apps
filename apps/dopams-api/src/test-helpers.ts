import { FastifyInstance } from "fastify";
import { buildApp } from "./app";

const DB_URL =
  process.env.DOPAMS_DATABASE_URL ||
  "postgres://puda:puda@localhost:5432/dopams";

/**
 * Build the Fastify app with logging disabled for test runs.
 * Sets VITEST env var so the auth middleware picks up test mode.
 */
export async function buildTestApp(): Promise<FastifyInstance> {
  process.env.VITEST = "true";
  process.env.DOPAMS_DATABASE_URL = DB_URL;
  process.env.RATE_LIMIT_MAX = "10000"; // disable rate-limiting in tests
  const app = await buildApp(false);
  await app.ready();
  return app;
}

/**
 * Log in with the given credentials and return a Bearer token.
 */
export async function getAuthToken(
  app: FastifyInstance,
  username = "admin",
  password = "password",
): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { username, password },
  });
  const body = JSON.parse(res.body);
  if (!body.token) {
    throw new Error(
      `getAuthToken failed for ${username}: ${res.statusCode} – ${res.body}`,
    );
  }
  return body.token as string;
}

/**
 * Convenience: inject an authenticated request.
 */
export async function authInject(
  app: FastifyInstance,
  token: string,
  opts: {
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    url: string;
    payload?: Record<string, unknown> | string;
  },
) {
  return app.inject({
    method: opts.method,
    url: opts.url,
    headers: { authorization: `Bearer ${token}` },
    ...(opts.payload !== undefined ? { payload: opts.payload } : {}),
  });
}

/**
 * Probe the database to see if the seed data is available.
 * Returns true when the admin user exists.
 */
export async function isDatabaseReady(app: FastifyInstance): Promise<boolean> {
  try {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { username: "admin", password: "password" },
    });
    return res.statusCode === 200;
  } catch {
    return false;
  }
}
