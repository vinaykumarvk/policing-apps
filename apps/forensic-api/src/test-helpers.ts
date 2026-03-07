import { FastifyInstance } from "fastify";
import { createTestHelpers } from "@puda/api-core";
import { buildApp } from "./app";

const helpers = createTestHelpers({
  buildApp,
  dbUrlEnvVar: "FORENSIC_DATABASE_URL",
  defaultDbUrl: "postgres://puda:puda@localhost:5432/forensic",
});

export type TestApp = FastifyInstance;

export const NON_EXISTENT_UUID = "00000000-0000-0000-0000-000000000000";

export const SEED_USERS = {
  examiner: { username: "examiner1", password: "password" },
  supervisor: { username: "supervisor1", password: "password" },
};

export const buildTestApp = helpers.buildTestApp;
export const isDatabaseReady = helpers.isDatabaseReady;

/** Wraps getAuthToken to return null instead of throwing when DB is unavailable */
export async function getAuthToken(
  app: FastifyInstance,
  username = "admin",
  password = "password",
): Promise<string | null> {
  try {
    return await helpers.getAuthToken(app, username, password);
  } catch {
    return null;
  }
}

/**
 * Authenticated inject helper — supports both call signatures:
 *   authInject(app, token, method, url, body?)        — positional
 *   authInject(app, token, { method, url, payload? })  — opts object
 */
export async function authInject(
  app: FastifyInstance,
  token: string,
  methodOrOpts: string | { method: string; url: string; payload?: Record<string, unknown> | string },
  url?: string,
  body?: Record<string, unknown> | string,
) {
  if (typeof methodOrOpts === "object") {
    // opts-object form
    const res = await helpers.authInject(app, token, {
      method: methodOrOpts.method as any,
      url: methodOrOpts.url,
      payload: methodOrOpts.payload,
    });
    // Normalize: expose both .body and .payload
    return Object.assign(res, { payload: res.body });
  }
  // positional form
  const res = await helpers.authInject(app, token, {
    method: methodOrOpts as any,
    url: url!,
    payload: body,
  });
  return Object.assign(res, { payload: res.body });
}
