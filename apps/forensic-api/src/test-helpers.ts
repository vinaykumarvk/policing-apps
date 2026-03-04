/**
 * Test helpers for Forensic API integration tests.
 * Provides app builder, auth token retrieval, and authenticated injection.
 */
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "..", "..", "..", ".env") });

import { buildApp } from "./app";

export type TestApp = Awaited<ReturnType<typeof buildApp>>;

export async function buildTestApp(): Promise<TestApp> {
  return buildApp(false);
}

/**
 * Login and return a JWT token for the given credentials.
 * Returns null if login fails (e.g. wrong password or DB not available).
 */
export async function getAuthToken(
  app: TestApp,
  username: string,
  password: string,
): Promise<string | null> {
  const res = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { username, password },
  });
  if (res.statusCode !== 200) return null;
  return JSON.parse(res.payload).token;
}

/**
 * Inject a request with Bearer token authentication.
 */
export function authInject(
  app: TestApp,
  token: string,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  url: string,
  body?: unknown,
) {
  const opts: Record<string, unknown> = {
    method,
    url,
    headers: { authorization: `Bearer ${token}` },
  };
  if (body !== undefined) {
    opts.payload = body;
  }
  return app.inject(opts as any);
}

/** Seed user credentials matching the seed script */
export const SEED_USERS = {
  admin: { username: "admin", password: "password", role: "ADMINISTRATOR" },
  examiner: { username: "examiner1", password: "password", role: "FORENSIC_ANALYST" },
  supervisor: { username: "supervisor1", password: "password", role: "SUPERVISOR" },
} as const;

/** A UUID that will never match any existing record */
export const NON_EXISTENT_UUID = "00000000-0000-0000-0000-000000000000";
