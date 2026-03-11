import Fastify, { FastifyInstance } from "fastify";
import helmet from "@fastify/helmet";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import compress from "@fastify/compress";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { registerAuthMiddleware, DEV_JWT_SECRET } from "./middleware/auth";
import { registerAuditLogger } from "./middleware/audit-logger";
import { setLogContext } from "./log-context";
import { registerAuthRoutes } from "./routes/auth.routes";
import { registerAlertRoutes } from "./routes/alert.routes";
import { registerLeadRoutes } from "./routes/lead.routes";
import { registerSubjectRoutes } from "./routes/subject.routes";
import { registerCaseRoutes } from "./routes/case.routes";
import { registerTaskRoutes } from "./routes/task.routes";
import { registerAdminRoutes } from "./routes/admin.routes";
import { registerNotesRoutes } from "./routes/notes.routes";
import { registerNotificationRoutes } from "./routes/notification.routes";
import { registerMemoRoutes } from "./routes/memo.routes";
import { registerConfigRoutes } from "./routes/config.routes";
import { registerOcrRoutes } from "./routes/ocr.routes";
import { registerClassifyRoutes } from "./routes/classify.routes";
import { registerSearchRoutes } from "./routes/search.routes";
import { registerExtractRoutes } from "./routes/extract.routes";
import { registerLegalRoutes } from "./routes/legal.routes";
import { registerTranslateRoutes } from "./routes/translate.routes";
import { registerNlQueryRoutes } from "./routes/nl-query.routes";
import { registerGraphRoutes } from "./routes/graph.routes";
import { registerGeofenceRoutes } from "./routes/geofence.routes";
import { registerDrugClassifyRoutes } from "./routes/drug-classify.routes";
import { registerModelRoutes } from "./routes/model.routes";
import { registerDashboardRoutes } from "./routes/dashboard.routes";
import { registerIngestionRoutes } from "./routes/ingestion.routes";
import { registerEcourtsRoutes } from "./routes/ecourts.routes";
import { registerUnocrossRoutes } from "./routes/unocross.routes";
import { registerMonthlyReportRoutes } from "./routes/monthly-report.routes";
import { registerDedupRoutes } from "./routes/dedup.routes";
import { registerTaxonomyRoutes } from "./routes/taxonomy.routes";
import { registerDossierRoutes } from "./routes/dossier.routes";
import { registerInterrogationRoutes } from "./routes/interrogation.routes";
import { registerJurisdictionRoutes } from "./routes/jurisdiction.routes";
import { registerWatchlistRoutes } from "./routes/watchlist.routes";
import { registerCdrRoutes } from "./routes/cdr.routes";
import { registerEvidenceRoutes } from "./routes/evidence.routes";
import { registerContentMonitoringRoutes } from "./routes/content-monitoring.routes";
import { registerAssertionConflictRoutes } from "./routes/assertion-conflict.routes";
import { registerAssertionRoutes } from "./routes/assertion.routes";
import { registerEntityRoutes } from "./routes/entity.routes";
import { registerEarlyWarningRoutes } from "./routes/early-warning.routes";
import { registerEscalationRoutes } from "./routes/escalation.routes";
import { registerPrivacyRoutes } from "./routes/privacy.routes";
import { registerSavedSearchRoutes } from "./routes/saved-search.routes";
import { registerSlangRoutes } from "./routes/slang.routes";
import { registerQueueRoutingRoutes } from "./routes/queue-routing.routes";
import { registerReportTemplateRoutes } from "./routes/report-template.routes";
import { registerReportGenerateRoutes } from "./routes/report-generate.routes";
import { createOidcAuth, createOidcRoutes, createAuthMiddleware, createConfigGovernanceRoutes, createIdempotencyMiddleware, createLdapAuth, createAuthRoutes as createSharedAuthRoutes } from "@puda/api-core";
import { query } from "./db";


export async function buildApp(logger = true): Promise<FastifyInstance> {
  const isTestRuntime = process.env.NODE_ENV === "test" || process.env.VITEST === "true";
  const isProduction = process.env.NODE_ENV === "production";

  const rawAllowedOrigins = process.env.ALLOWED_ORIGINS;
  if (isProduction && !rawAllowedOrigins) {
    throw new Error("FATAL: ALLOWED_ORIGINS must be set in production (comma-separated list of allowed origins)");
  }
  const allowedOrigins = rawAllowedOrigins
    ? rawAllowedOrigins.split(",").map((o) => o.trim()).filter(Boolean)
    : isTestRuntime ? true : [];

  const app = Fastify({ logger, bodyLimit: 10_485_760 }); // 10 MB

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
  });
  await app.register(compress, { global: true, threshold: 1024 });
  await app.register(cors, {
    origin: allowedOrigins,
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-Idempotency-Key"],
  });
  await app.register(cookie);

  const globalRateLimitMax = Number.parseInt(process.env.RATE_LIMIT_MAX || "100", 10);
  await app.register(rateLimit, {
    max: Number.isFinite(globalRateLimitMax) ? globalRateLimitMax : 100,
    timeWindow: process.env.RATE_LIMIT_WINDOW || "1 minute",
  });

  // Apply stricter rate limits to mutation endpoints (POST/PUT/PATCH/DELETE).
  // Auth login has its own even stricter limit set in auth.routes.ts.
  app.addHook("onRoute", (routeOptions) => {
    if (
      routeOptions.config?.rateLimit ||
      routeOptions.url === "/health" ||
      routeOptions.url === "/ready"
    ) {
      return;
    }
    const methods = Array.isArray(routeOptions.method)
      ? routeOptions.method
      : [routeOptions.method];
    const isMutation = methods.some((m: string) =>
      ["POST", "PUT", "PATCH", "DELETE"].includes(m),
    );
    if (isMutation) {
      routeOptions.config = routeOptions.config || {};
      (routeOptions.config as Record<string, unknown>).rateLimit = {
        max: 30,
        timeWindow: "1 minute",
      };
    }
  });

  const docsEnabled = process.env.NODE_ENV !== "production";
  await app.register(swagger, {
    openapi: {
      info: {
        title: "DOPAMS API",
        description: "Drug Operations Planning, Analysis and Management System API.",
        version: "1.0.0",
      },
      tags: [
        { name: "health", description: "Health check endpoints" },
        { name: "auth", description: "Authentication and authorization" },
        { name: "alerts", description: "Alert management" },
        { name: "cases", description: "Case management" },
        { name: "leads", description: "Lead management" },
        { name: "subjects", description: "Subject management" },
        { name: "tasks", description: "Task management" },
        { name: "admin", description: "Administration" },
        { name: "notes", description: "Notes management" },
        { name: "notifications", description: "Notification management" },
        { name: "config", description: "Configuration management" },
        { name: "ocr", description: "Optical character recognition" },
        { name: "classify", description: "Content classification" },
        { name: "search", description: "Search operations" },
        { name: "extract", description: "Entity extraction" },
        { name: "legal", description: "Legal operations" },
        { name: "translate", description: "Translation services" },
        { name: "nl-query", description: "Natural language query" },
        { name: "graph", description: "Graph analysis" },
        { name: "geofence", description: "Geofence management" },
        { name: "drug-classify", description: "Drug classification" },
        { name: "models", description: "Model governance" },
        { name: "memo", description: "Memo management" },
        { name: "dedup", description: "Subject deduplication" },
        { name: "dossiers", description: "Intelligence dossier assembly and export" },
        { name: "interrogation", description: "Interrogation reports and report templates" },
        { name: "evidence", description: "Digital evidence chain of custody" },
        { name: "content-monitoring", description: "Cross-platform content monitoring" },
      ],
      components: {
        securitySchemes: {
          bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        },
      },
    },
  });
  if (docsEnabled) {
    await app.register(swaggerUi, { routePrefix: "/docs" });
  }

  app.setErrorHandler((error, _request, reply) => {
    const err = error as Error & { statusCode?: number; code?: string };
    const statusCode = err.statusCode || 500;
    if (statusCode >= 500) {
      app.log.error(err);
      return reply.code(500).send({ error: "INTERNAL_ERROR", message: "An unexpected error occurred", statusCode: 500 });
    }
    return reply.code(statusCode).send({ error: err.code || "ERROR", message: err.message, statusCode });
  });

  registerAuthMiddleware(app);
  registerAuditLogger(app);

  // Idempotency middleware for write endpoints
  const idempotencyMiddleware = createIdempotencyMiddleware({ queryFn: query });
  idempotencyMiddleware.register(app);

  app.addHook("onRequest", async (request) => {
    setLogContext({ requestId: request.id });
  });

  app.addHook("onResponse", async (request, reply) => {
    setLogContext({ requestId: request.id });
    const duration = reply.elapsedTime;
    if (duration > 1000) {
      const { logWarn } = await import("./logger");
      logWarn("SLOW_REQUEST", { method: request.method, url: request.url, statusCode: reply.statusCode, durationMs: Math.round(duration) });
    }
  });

  app.get("/health", async () => ({ status: "ok" }));

  app.get("/ready", async (_request, reply) => {
    try {
      const { query: dbQuery } = await import("./db");
      await dbQuery("SELECT 1");
      return { status: "ok" };
    } catch {
      reply.code(503);
      return { status: "degraded", reason: "database_unreachable" };
    }
  });

  await registerAuthRoutes(app);
  await registerAlertRoutes(app);
  await registerLeadRoutes(app);
  await registerSubjectRoutes(app);
  await registerCaseRoutes(app);
  await registerTaskRoutes(app);
  await app.register(registerAdminRoutes);
  await registerNotesRoutes(app);
  await registerNotificationRoutes(app);
  await registerMemoRoutes(app);
  await registerConfigRoutes(app);
  await registerOcrRoutes(app);
  await registerClassifyRoutes(app);
  await registerSearchRoutes(app);
  await registerExtractRoutes(app);
  await registerLegalRoutes(app);
  await registerTranslateRoutes(app);
  await registerNlQueryRoutes(app);
  await registerGraphRoutes(app);
  await registerGeofenceRoutes(app);
  await registerDrugClassifyRoutes(app);
  await registerModelRoutes(app);
  await registerDashboardRoutes(app);
  await registerIngestionRoutes(app);
  await registerEcourtsRoutes(app);
  await registerUnocrossRoutes(app);
  await registerMonthlyReportRoutes(app);
  await registerDedupRoutes(app);
  await registerTaxonomyRoutes(app);
  await registerDossierRoutes(app);
  await registerInterrogationRoutes(app);
  await registerJurisdictionRoutes(app);
  await registerWatchlistRoutes(app);
  await registerCdrRoutes(app);
  await registerEvidenceRoutes(app);
  await registerContentMonitoringRoutes(app);
  await registerAssertionConflictRoutes(app);
  await registerAssertionRoutes(app);
  await registerEntityRoutes(app);
  await registerEarlyWarningRoutes(app);
  await registerEscalationRoutes(app);
  await registerPrivacyRoutes(app);
  await registerSavedSearchRoutes(app);
  await registerSlangRoutes(app);
  await registerQueueRoutingRoutes(app);
  await registerReportTemplateRoutes(app);
  await registerReportGenerateRoutes(app);

  // Config governance routes (always available)
  const registerConfigGovernanceRoutes = createConfigGovernanceRoutes({ queryFn: query });
  await registerConfigGovernanceRoutes(app);

  // LDAP auth (conditionally enabled via env)
  if (process.env.LDAP_URL) {
    const ldapAuth = createLdapAuth({
      url: process.env.LDAP_URL,
      baseDn: process.env.LDAP_BASE_DN || "",
      bindDn: process.env.LDAP_BIND_DN,
      bindPassword: process.env.LDAP_BIND_PASSWORD,
    }, query);
    const auth = createAuthMiddleware({
      cookieName: "dopams_auth",
      defaultDevSecret: DEV_JWT_SECRET,
      queryFn: query,
    });
    const registerLdapAuthRoutes = createSharedAuthRoutes({ queryFn: query, auth, ldapAuth });
    await registerLdapAuthRoutes(app);
  }

  // OIDC routes (conditionally enabled via env)
  if (process.env.OIDC_ISSUER_URL) {
    const auth = createAuthMiddleware({
      cookieName: "dopams_auth",
      defaultDevSecret: DEV_JWT_SECRET,
      queryFn: query,
    });
    const oidc = createOidcAuth({
      issuerUrl: process.env.OIDC_ISSUER_URL,
      clientId: process.env.OIDC_CLIENT_ID || "dopams",
      clientSecret: process.env.OIDC_CLIENT_SECRET,
      redirectUri: process.env.OIDC_REDIRECT_URI || "http://localhost:3001/api/v1/auth/oidc/callback",
      claimMapping: {
        userId: process.env.OIDC_CLAIM_USER_ID,
        userType: process.env.OIDC_CLAIM_USER_TYPE,
        roles: process.env.OIDC_CLAIM_ROLES,
        unitId: process.env.OIDC_CLAIM_UNIT_ID,
      },
    }, query);
    const registerOidcRoutes = createOidcRoutes({ auth, oidc });
    await registerOidcRoutes(app);
  }

  return app;
}
