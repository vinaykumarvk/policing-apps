import { FastifyInstance } from "fastify";
import { analyzeNetwork, getNodeAnalysis, getKingpins } from "../services/graph-analysis";
import { sendError } from "../errors";

export async function registerGraphRoutes(app: FastifyInstance): Promise<void> {
  // Run full network analysis
  app.post("/api/v1/graph/analyze", async (request, reply) => {
    try {
      const result = await analyzeNetwork();
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
