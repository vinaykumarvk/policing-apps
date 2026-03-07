import { createAuthRoutes, createAuthMiddleware } from "@puda/api-core";
import { query } from "../db";

const auth = createAuthMiddleware({
  cookieName: "sm_auth",
  defaultDevSecret: "sm-dev-secret-DO-NOT-USE-IN-PRODUCTION",
  queryFn: query,
});

export const registerAuthRoutes = createAuthRoutes({ queryFn: query, auth });
