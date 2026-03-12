import { FastifyInstance } from "fastify";
import { executeNlQuery, getQueryHistory } from "../services/nl-query";
import { sendError } from "../errors";

export async function registerNlQueryRoutes(app: FastifyInstance): Promise<void> {
  // Execute a natural-language query
  app.post("/api/v1/query", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["question"],
        properties: {
          question: { type: "string", minLength: 1 },
        },
      },
    },
  }, async (request, reply) => {
    const { question } = request.body as { question: string };

    if (!question || question.trim().length === 0) {
      return sendError(reply, 400, "VALIDATION_ERROR", "Question is required");
    }

    const userId = request.authUser?.userId;
    const unitId = request.authUser?.unitId || null;

    if (!userId) {
      return sendError(reply, 401, "AUTHENTICATION_REQUIRED", "User must be authenticated");
    }

    try {
      const result = await executeNlQuery(question.trim(), userId, unitId);

      // Transform to frontend-expected shape:
      // - table: { columns, rows } (already in correct shape)
      // - citations: { entity_type, entity_id, title } (mapped from camelCase)
      return {
        summary: result.summary,
        table: result.table,
        citations: result.citations.map(c => ({
          entity_type: c.entityType,
          entity_id: c.entityId,
          title: c.field,
        })),
        source: result.source,
      };
    } catch (err: unknown) {
      request.log.error(err, "NL query execution failed");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Retrieve query history for the authenticated user
  app.get("/api/v1/query/history", async (request, reply) => {
    try {
      const userId = request.authUser?.userId;
      if (!userId) {
        return sendError(reply, 401, "AUTHENTICATION_REQUIRED", "User must be authenticated");
      }

      const { limit } = request.query as { limit?: string };
      const parsedLimit = Math.min(Math.max(parseInt(limit || "20", 10) || 20, 1), 100);

      const history = await getQueryHistory(userId, parsedLimit);
      return { history };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get query history");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });
}
