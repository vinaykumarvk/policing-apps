import Fastify, { FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import compress from "@fastify/compress";
import rateLimit from "@fastify/rate-limit";
import { registerAuthMiddleware } from "./middleware/auth";
import { registerAuthRoutes } from "./routes/auth.routes";
import { registerAlertRoutes } from "./routes/alert.routes";
import { registerLeadRoutes } from "./routes/lead.routes";
import { registerSubjectRoutes } from "./routes/subject.routes";
import { registerCaseRoutes } from "./routes/case.routes";
import { registerTaskRoutes } from "./routes/task.routes";
import { registerAdminRoutes } from "./routes/admin.routes";
import { sendError } from "./errors";

export async function buildApp(logger = true): Promise<FastifyInstance> {
  const app = Fastify({ logger });

  const rawAllowedOrigins = process.env.ALLOWED_ORIGINS;
  const isTestRuntime = process.env.NODE_ENV === "test" || process.env.VITEST === "true";
  const allowedOrigins = rawAllowedOrigins
    ? rawAllowedOrigins.split(",").map((o) => o.trim()).filter(Boolean)
    : true;

  await app.register(compress, { global: true, threshold: 1024 });
  await app.register(cors, { origin: allowedOrigins, credentials: true });
  await app.register(cookie);

  const globalRateLimitMax = Number.parseInt(process.env.RATE_LIMIT_MAX || "100", 10);
  await app.register(rateLimit, {
    max: Number.isFinite(globalRateLimitMax) ? globalRateLimitMax : 100,
    timeWindow: process.env.RATE_LIMIT_WINDOW || "1 minute",
  });

  app.setErrorHandler((error, _request, reply) => {
    const err = error as Error & { statusCode?: number; code?: string };
    const statusCode = err.statusCode || 500;
    if (statusCode >= 500) {
      app.log.error(err);
      return reply.send(sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred"));
    }
    return reply.send(sendError(reply, statusCode, err.code || "ERROR", err.message));
  });

  registerAuthMiddleware(app);

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
  await registerAdminRoutes(app);

  return app;
}
