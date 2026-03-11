import { FastifyInstance } from "fastify";
import { createAuthRoutes } from "@puda/api-core";
import { createAuthMiddleware } from "@puda/api-core";
import { query } from "../db";
import { DEV_JWT_SECRET } from "../middleware/auth";

const auth = createAuthMiddleware({
  cookieName: "dopams_auth",
  defaultDevSecret: DEV_JWT_SECRET,
  queryFn: query,
});

const baseRegister = createAuthRoutes({ queryFn: query, auth });

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  await baseRegister(app);

  // FR-01: LDAP authentication stub (schema-ready, awaits infrastructure)
  app.post("/api/v1/auth/ldap", {
    schema: {
      tags: ["auth"],
      body: {
        type: "object",
        additionalProperties: false,
        required: ["username", "password", "domain"],
        properties: {
          username: { type: "string", minLength: 1, maxLength: 255 },
          password: { type: "string", minLength: 1 },
          domain: { type: "string", minLength: 1, maxLength: 255 },
        },
      },
    },
  }, async (_request, reply) => {
    reply.code(501);
    return {
      error: "LDAP_NOT_CONFIGURED",
      message: "LDAP integration requires infrastructure setup",
    };
  });
}
