import { FastifyInstance } from "fastify";
import { analyzeNetwork, getNodeAnalysis, getKingpins } from "../services/graph-analysis";
import { sendError } from "../errors";

export async function registerGraphRoutes(app: FastifyInstance): Promise<void> {
  // Run full network analysis with configurable depth
  app.post("/api/v1/graph/analyze", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        properties: {
          maxDepth: { type: "integer", minimum: 1, maximum: 10, default: 3 },
          rootEntityId: { type: "string", format: "uuid" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { maxDepth, rootEntityId } = (request.body || {}) as { maxDepth?: number; rootEntityId?: string };
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

  // Get analysis for a specific node
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
    },
  }, async (request, reply) => {
    try {
      const { entityId } = request.params as { entityId: string };
      const analysis = await getNodeAnalysis(entityId);
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
