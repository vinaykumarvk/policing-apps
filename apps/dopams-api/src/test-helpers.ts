import { createTestHelpers } from "@puda/api-core";
import { buildApp } from "./app";

const helpers = createTestHelpers({
  buildApp,
  dbUrlEnvVar: "DOPAMS_DATABASE_URL",
  defaultDbUrl: "postgres://puda:puda@localhost:5432/dopams",
});

export const buildTestApp = helpers.buildTestApp;
export const getAuthToken = helpers.getAuthToken;
export const authInject = helpers.authInject;
export const isDatabaseReady = helpers.isDatabaseReady;
