import { FastifyInstance } from "fastify";
import { analyzeNetwork, getNodeAnalysis, getKingpins } from "../services/graph-analysis";
import { sendError } from "../errors";
import { createRoleGuard } from "@puda/api-core";

export async function registerGraphRoutes(app: FastifyInstance): Promise<void> {
  const requireGraphAnalysis = createRoleGuard(["INTELLIGENCE_ANALYST", "SUPERVISORY_OFFICER", "ADMINISTRATOR"]);

  // FR-11 AC-04/05: Run full network analysis with configurable depth and factor params
  app.post("/api/v1/graph/analyze", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        properties: {
          maxDepth: { type: "integer", minimum: 1, maximum: 10, default: 3 },
          rootEntityId: { type: "string", format: "uuid" },
          factors: {
            type: "object",
            additionalProperties: false,
            properties: {
              includeFinancial: { type: "boolean", default: true },
              includeCommunication: { type: "boolean", default: true },
              includeAssociation: { type: "boolean", default: true },
              minWeight: { type: "number", minimum: 0, maximum: 1, default: 0 },
            },
          },
          dateFrom: { type: "string", format: "date" },
          dateTo: { type: "string", format: "date" },
        },
      },
    },
  }, async (request, reply) => {
    if (!requireGraphAnalysis(request, reply)) return;
    try {
      const { maxDepth, rootEntityId, factors, dateFrom, dateTo } = (request.body || {}) as {
        maxDepth?: number; rootEntityId?: string;
        factors?: { includeFinancial?: boolean; includeCommunication?: boolean; includeAssociation?: boolean; minWeight?: number };
        dateFrom?: string; dateTo?: string;
      };
      const depth = Math.min(maxDepth || 3, 10);

      // For deep analysis (depth > 5), create an async job instead
      if (depth > 5) {
        const { createAnalysisJob } = await import("../services/cdr-analysis");
        const { userId } = request.authUser!;
        const job = await createAnalysisJob("GRAPH_ANALYSIS", rootEntityId || null, { maxDepth: depth }, userId);
        reply.code(202);
        return { message: "Deep analysis queued as async job", job };
      }

      const result = await analyzeNetwork(depth);
      return result;
    } catch (err: unknown) {
      request.log.error(err, "Network analysis failed");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // FR-11 AC-04: Get analysis for a specific node with optional date filters
  app.get("/api/v1/graph/node/:entityId", {
    schema: {
      params: {
        type: "object",
        additionalProperties: false,
        required: ["entityId"],
        properties: {
          entityId: { type: "string", format: "uuid" },
        },
      },
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          dateFrom: { type: "string", format: "date" },
          dateTo: { type: "string", format: "date" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { entityId } = request.params as { entityId: string };
      const { dateFrom, dateTo } = (request.query || {}) as { dateFrom?: string; dateTo?: string };
      const analysis = await getNodeAnalysis(entityId, dateFrom, dateTo);
      if (!analysis) return reply.code(404).send({ error: "NOT_FOUND", message: "No analysis found for this entity" });
      return analysis;
    } catch (err: unknown) {
      request.log.error(err, "Failed to get node analysis");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Get kingpins
  app.get("/api/v1/graph/kingpins", async (request, reply) => {
    try {
      const kingpins = await getKingpins();
      return { kingpins };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get kingpins");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });
}
