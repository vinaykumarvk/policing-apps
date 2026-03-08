import { createAuditLogger } from "@puda/api-core";
import { query } from "../db";

const auditLogger = createAuditLogger({ queryFn: query, tableName: "audit_log" });

export function registerAuditLogger(app: import("fastify").FastifyInstance) {
  auditLogger.register(app);
}
