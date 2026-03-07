import Fastify, { FastifyInstance } from "fastify";
import helmet from "@fastify/helmet";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import compress from "@fastify/compress";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { registerAuthMiddleware, registerMfaEnforcement } from "./middleware/auth";
import { registerAuditLogger } from "./middleware/audit-logger";
import { setLogContext } from "./log-context";
import { registerAuthRoutes } from "./routes/auth.routes";
import { registerCaseRoutes } from "./routes/case.routes";
import { registerEvidenceRoutes } from "./routes/evidence.routes";
import { registerImportRoutes } from "./routes/import.routes";
import { registerArtifactRoutes } from "./routes/artifact.routes";
import { registerFindingRoutes } from "./routes/finding.routes";
import { registerReportRoutes } from "./routes/report.routes";
import { registerTaskRoutes } from "./routes/task.routes";
import { registerAdminRoutes } from "./routes/admin.routes";
import { registerNotesRoutes } from "./routes/notes.routes";
import { registerNotificationRoutes } from "./routes/notification.routes";
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
import { registerDopamsSyncRoutes } from "./routes/dopams-sync.routes";
import { registerEntityOpsRoutes } from "./routes/entity-ops.routes";
import { registerDictionaryRoutes } from "./routes/dictionary.routes";
import { registerDataLifecycleRoutes } from "./routes/data-lifecycle.routes";
import { createOidcAuth, createOidcRoutes, createAuthMiddleware, createConfigGovernanceRoutes, createIdempotencyMiddleware } from "@puda/api-core";
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
  await app.register(cors, { origin: allowedOrigins, credentials: true });
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
        title: "Forensic Lab API",
        description: "Digital forensic laboratory case management and analysis API.",
        version: "1.0.0",
      },
      tags: [
        { name: "health", description: "Health check endpoints" },
        { name: "auth", description: "Authentication and authorization" },
        { name: "cases", description: "Case management" },
        { name: "evidence", description: "Evidence management" },
        { name: "findings", description: "Findings management" },
        { name: "reports", description: "Report generation" },
        { name: "imports", description: "Data import" },
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
        { name: "entity-ops", description: "Entity merge and split operations" },
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
  registerMfaEnforcement(app);
  registerAuditLogger(app);

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
  await registerCaseRoutes(app);
  await registerEvidenceRoutes(app);
  await registerImportRoutes(app);
  await registerArtifactRoutes(app);
  await registerFindingRoutes(app);
  await registerReportRoutes(app);
  await registerTaskRoutes(app);
  await app.register(registerAdminRoutes);
  await registerNotesRoutes(app);
  await registerNotificationRoutes(app);
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
  await registerDopamsSyncRoutes(app);
  await registerEntityOpsRoutes(app);
  await registerDictionaryRoutes(app);
  await registerDataLifecycleRoutes(app);

  // Config governance routes
  const registerConfigGovernanceRoutes = createConfigGovernanceRoutes({ queryFn: query });
  await registerConfigGovernanceRoutes(app);

  // OIDC routes (conditionally enabled via env)
  if (process.env.OIDC_ISSUER_URL) {
    const auth = createAuthMiddleware({
      cookieName: "forensic_auth",
      defaultDevSecret: "forensic-dev-secret-DO-NOT-USE-IN-PRODUCTION",
      queryFn: query,
    });
    const oidc = createOidcAuth({
      issuerUrl: process.env.OIDC_ISSUER_URL,
      clientId: process.env.OIDC_CLIENT_ID || "forensic",
      clientSecret: process.env.OIDC_CLIENT_SECRET,
      redirectUri: process.env.OIDC_REDIRECT_URI || "http://localhost:3002/api/v1/auth/oidc/callback",
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
