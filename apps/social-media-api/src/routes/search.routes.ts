import { FastifyInstance } from "fastify";
import { globalSearch } from "../services/search";
import { sendError } from "../errors";

export async function registerSearchRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/search", async (request, reply) => {
    try {
      const {
        q,
        fuzzy,
        transliterate: trans,
        limit: rawLimit,
        offset: rawOffset,
        entity_types,
      } = request.query as Record<string, string | undefined>;

      if (!q || q.trim().length === 0) {
        return sendError(reply, 400, "VALIDATION_ERROR", "Query parameter 'q' is required");
      }

      const limit = Math.min(parseInt(rawLimit || "20", 10) || 20, 100);
      const offset = Math.max(parseInt(rawOffset || "0", 10) || 0, 0);

      const results = await globalSearch({
        q,
        fuzzy: fuzzy === "true",
        transliterate: trans === "true",
        limit,
        offset,
        entityTypes: entity_types ? entity_types.split(",") : undefined,
      });

      return results;
    } catch (err: unknown) {
      request.log.error(err, "Failed to execute search");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });
}
