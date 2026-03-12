import { FastifyInstance } from "fastify";
import { send400, send404, sendError } from "../errors";
import { createRoleGuard } from "@puda/api-core";
import {
  insertAssertion,
  approveAssertion,
  rejectAssertion,
  getAssertions,
  getConflicts,
  bulkReview,
  getTrustConfig,
  updateTrustRank,
} from "../services/assertion-engine";

export async function registerAssertionRoutes(app: FastifyInstance): Promise<void> {
  const requireAnalyst = createRoleGuard(["INTELLIGENCE_ANALYST", "SUPERVISORY_OFFICER", "ADMINISTRATOR"]);
  const requireAdmin = createRoleGuard(["ADMINISTRATOR"]);

  // FR-04 AC-02: Create an assertion (per-field provenance)
  app.post("/api/v1/subjects/:id/assertions", {
    schema: {
      params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: {
        type: "object",
        additionalProperties: false,
        required: ["attributeName", "attributeValue", "sourceSystem"],
        properties: {
          attributeName: { type: "string", maxLength: 100 },
          attributeValue: { type: "string", maxLength: 4000 },
          sourceSystem: { type: "string", maxLength: 50 },
          sourceDocumentId: { type: "string", format: "uuid" },
          confidenceScore: { type: "number", minimum: 0, maximum: 100 },
          effectiveFrom: { type: "string", format: "date" },
          effectiveTo: { type: "string", format: "date" },
        },
      },
    },
  }, async (request, reply) => {
    if (!requireAnalyst(request, reply)) return;
    try {
      const { id } = request.params as { id: string };
      const body = request.body as {
        attributeName: string; attributeValue: string; sourceSystem: string;
        sourceDocumentId?: string; confidenceScore?: number;
        effectiveFrom?: string; effectiveTo?: string;
      };
      const { userId } = request.authUser!;

      const assertion = await insertAssertion({
        subjectId: id,
        attributeName: body.attributeName,
        attributeValue: body.attributeValue,
        sourceSystem: body.sourceSystem,
        sourceDocumentId: body.sourceDocumentId,
        confidenceScore: body.confidenceScore,
        effectiveFrom: body.effectiveFrom,
        effectiveTo: body.effectiveTo,
        createdBy: userId,
      });

      reply.code(201);
      return { assertion };
    } catch (err: unknown) {
      request.log.error(err, "Failed to insert assertion");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // FR-04 AC-02: List assertions for a subject
  app.get("/api/v1/subjects/:id/assertions", {
    schema: {
      params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          attribute: { type: "string", maxLength: 100 },
          status: { type: "string", enum: ["AUTO_PROPOSED", "REVIEWED", "APPROVED", "REJECTED", "CONFLICTING", "NOT_AVAILABLE"] },
          current_only: { type: "string", enum: ["true", "false"] },
          limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
          offset: { type: "integer", minimum: 0, default: 0 },
        },
      },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const qs = request.query as Record<string, string | undefined>;
    const limit = Math.min(parseInt(qs.limit || "50", 10) || 50, 200);
    const offset = Math.max(parseInt(qs.offset || "0", 10) || 0, 0);

    return getAssertions(id, {
      attributeName: qs.attribute,
      reviewStatus: qs.status,
      currentOnly: qs.current_only === "true",
      limit,
      offset,
    });
  });

  // FR-04: Approve an assertion
  app.post("/api/v1/assertions/:assertionId/approve", {
    schema: {
      params: { type: "object", required: ["assertionId"], properties: { assertionId: { type: "string", format: "uuid" } } },
    },
  }, async (request, reply) => {
    if (!requireAnalyst(request, reply)) return;
    try {
      const { assertionId } = request.params as { assertionId: string };
      const { userId } = request.authUser!;
      const assertion = await approveAssertion(assertionId, userId);
      return { assertion };
    } catch (err: unknown) {
      const e = err as Error & { code?: string };
      if (e.code === "ASSERTION_NOT_FOUND") return send404(reply, "ASSERTION_NOT_FOUND", "Assertion not found");
      request.log.error(err, "Failed to approve assertion");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // FR-04: Reject an assertion
  app.post("/api/v1/assertions/:assertionId/reject", {
    schema: {
      params: { type: "object", required: ["assertionId"], properties: { assertionId: { type: "string", format: "uuid" } } },
    },
  }, async (request, reply) => {
    if (!requireAnalyst(request, reply)) return;
    try {
      const { assertionId } = request.params as { assertionId: string };
      const { userId } = request.authUser!;
      const assertion = await rejectAssertion(assertionId, userId);
      return { assertion };
    } catch (err: unknown) {
      const e = err as Error & { code?: string };
      if (e.code === "ASSERTION_NOT_FOUND") return send404(reply, "ASSERTION_NOT_FOUND", "Assertion not found");
      request.log.error(err, "Failed to reject assertion");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // FR-04: List conflicts awaiting review
  app.get("/api/v1/assertions/conflicts", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          subject_id: { type: "string", format: "uuid" },
          limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
          offset: { type: "integer", minimum: 0, default: 0 },
        },
      },
    },
  }, async (request) => {
    const qs = request.query as Record<string, string | undefined>;
    const limit = Math.min(parseInt(qs.limit || "50", 10) || 50, 200);
    const offset = Math.max(parseInt(qs.offset || "0", 10) || 0, 0);
    return getConflicts({ subjectId: qs.subject_id, limit, offset });
  });

  // FR-04: Bulk review — approve/reject multiple assertions
  app.post("/api/v1/assertions/bulk-review", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["decisions"],
        properties: {
          decisions: {
            type: "array",
            minItems: 1,
            maxItems: 100,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["assertionId", "action"],
              properties: {
                assertionId: { type: "string", format: "uuid" },
                action: { type: "string", enum: ["approve", "reject"] },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    if (!requireAnalyst(request, reply)) return;
    try {
      const { decisions } = request.body as { decisions: Array<{ assertionId: string; action: "approve" | "reject" }> };
      const { userId } = request.authUser!;
      const result = await bulkReview(decisions, userId);
      return result;
    } catch (err: unknown) {
      request.log.error(err, "Failed to bulk review assertions");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Admin: Get trust configuration
  app.get("/api/v1/assertions/trust-config", async () => {
    return { config: await getTrustConfig() };
  });

  // Admin: Update trust rank
  app.put("/api/v1/assertions/trust-config/:sourceSystem", {
    schema: {
      params: { type: "object", required: ["sourceSystem"], properties: { sourceSystem: { type: "string" } } },
      body: {
        type: "object",
        additionalProperties: false,
        required: ["trustRank"],
        properties: {
          trustRank: { type: "integer", minimum: 1, maximum: 5 },
        },
      },
    },
  }, async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    try {
      const { sourceSystem } = request.params as { sourceSystem: string };
      const { trustRank } = request.body as { trustRank: number };
      await updateTrustRank(sourceSystem, trustRank);
      return { success: true, sourceSystem, trustRank };
    } catch (err: unknown) {
      const e = err as Error & { code?: string };
      if (e.code === "SOURCE_NOT_FOUND") return send404(reply, "SOURCE_NOT_FOUND", "Source system not found");
      request.log.error(err, "Failed to update trust rank");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });
}
