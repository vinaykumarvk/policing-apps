import { FastifyInstance } from "fastify";
import fs from "fs";
import path from "path";
import { query } from "../db";
import { sendError } from "../errors";

export async function registerConfigRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/v1/config/workflows — list all workflow definitions
  app.get("/api/v1/config/workflows", async (request, reply) => {
    try {
      const defDir = path.resolve(__dirname, "..", "workflow-definitions");
      const files = fs.readdirSync(defDir).filter((f) => f.endsWith(".json"));
      const workflows = files.map((f) => {
        const raw = JSON.parse(fs.readFileSync(path.join(defDir, f), "utf-8"));
        return {
          workflowId: raw.workflowId,
          entityType: f.replace(".json", ""),
          stateCount: (raw.states || []).length,
          transitionCount: (raw.transitions || []).length,
        };
      });
      return { workflows };
    } catch (err: unknown) {
      request.log.error(err, "Failed to list workflow definitions");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // GET /api/v1/config/workflows/:entityType — full workflow definition
  app.get("/api/v1/config/workflows/:entityType", {
    schema: { params: { type: "object", additionalProperties: false, required: ["entityType"], properties: { entityType: { type: "string", pattern: "^[a-z][a-z0-9_]*$" } } } },
  }, async (request, reply) => {
    try {
      const { entityType } = request.params as { entityType: string };
      const baseDir = path.resolve(__dirname, "..", "workflow-definitions");
      const filePath = path.resolve(baseDir, `${entityType}.json`);
      if (!filePath.startsWith(baseDir + path.sep)) {
        reply.code(400);
        return { error: "INVALID_ENTITY_TYPE", message: "Invalid entity type" };
      }
      if (!fs.existsSync(filePath)) {
        reply.code(404);
        return { error: "WORKFLOW_NOT_FOUND", message: `No workflow definition for entity type: ${entityType}` };
      }
      const definition = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      return { definition };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get workflow definition");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // GET /api/v1/config/roles — list all roles
  app.get("/api/v1/config/roles", async (request, reply) => {
    try {
      const result = await query(
        `SELECT role_id, role_key, role_label, description, is_active, created_at
         FROM role ORDER BY role_key ASC`,
      );
      return { roles: result.rows, total: result.rows.length };
    } catch (err: unknown) {
      request.log.error(err, "Failed to list roles");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // GET /api/v1/config/sla — list SLA configuration per workflow state
  app.get("/api/v1/config/sla", async (request, reply) => {
    try {
      const defDir = path.resolve(__dirname, "..", "workflow-definitions");
      const files = fs.readdirSync(defDir).filter((f) => f.endsWith(".json"));
      const slaEntries: Array<{ entityType: string; stateId: string; slaDurationHours?: number }> = [];

      for (const f of files) {
        const raw = JSON.parse(fs.readFileSync(path.join(defDir, f), "utf-8"));
        const entityType = f.replace(".json", "");
        for (const state of raw.states || []) {
          if (state.sla) {
            slaEntries.push({
              entityType,
              stateId: state.stateId,
              slaDurationHours: state.sla.durationHours,
            });
          }
        }
      }
      return { slaConfig: slaEntries };
    } catch (err: unknown) {
      request.log.error(err, "Failed to list SLA configuration");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });
}
