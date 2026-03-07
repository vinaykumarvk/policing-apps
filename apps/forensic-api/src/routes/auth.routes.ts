import { FastifyInstance } from "fastify";
import { createAuthRoutes, createAuthMiddleware } from "@puda/api-core";
import { query } from "../db";

const auth = createAuthMiddleware({
  cookieName: "forensic_auth",
  defaultDevSecret: "forensic-dev-secret-DO-NOT-USE-IN-PRODUCTION",
  queryFn: query,
});

const baseAuthRoutes = createAuthRoutes({ queryFn: query, auth });

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  await baseAuthRoutes(app);

  // FR-14 AC-01 — SAML metadata endpoint stub
  app.get("/.well-known/saml-metadata.xml", async (_request, reply) => {
    const entityId = process.env.SAML_ENTITY_ID || "urn:forensic-api:saml";
    const acsUrl = process.env.SAML_ACS_URL || "http://localhost:3002/api/v1/auth/saml/callback";
    const metadata = `<?xml version="1.0"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${entityId}">
  <md:SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${acsUrl}" index="0"/>
  </md:SPSSODescriptor>
</md:EntityDescriptor>`;
    reply.header("Content-Type", "application/xml");
    return reply.send(metadata);
  });

  // SAML callback stub
  app.post("/api/v1/auth/saml/callback", async (_request, reply) => {
    return reply.code(501).send({ error: "NOT_IMPLEMENTED", message: "SAML SSO callback — configure SAML_IDP_METADATA_URL to enable" });
  });
}
