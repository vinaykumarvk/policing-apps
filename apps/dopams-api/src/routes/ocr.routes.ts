import { FastifyInstance } from "fastify";
import { submitOcrJob, getOcrJob, getOcrJobsByEvidence } from "../services/ocr-processor";
import { sendError, send400, send404 } from "../errors";

export async function registerOcrRoutes(app: FastifyInstance): Promise<void> {
  // Submit OCR job for a document / evidence item
  // FR-03: Accepts language parameter (te/en/hi) and confidence_threshold
  app.post("/api/v1/ocr/submit", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["evidenceId"],
        properties: {
          evidenceId: { type: "string", format: "uuid" },
          language: { type: "string", enum: ["en", "hi", "te"], default: "en" },
          confidenceThreshold: { type: "number", minimum: 0, maximum: 1, default: 0.7 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { evidenceId, language, confidenceThreshold } =
        request.body as { evidenceId: string; language?: string; confidenceThreshold?: number };
      if (!evidenceId) {
        return send400(reply, "VALIDATION_ERROR", "evidenceId is required");
      }
      const userId = request.authUser?.userId || "";
      const result = await submitOcrJob(evidenceId, userId, {
        language: language || "en",
        confidenceThreshold: confidenceThreshold ?? 0.7,
      });
      reply.code(201);
      return result;
    } catch (err: unknown) {
      request.log.error(err, "Failed to submit OCR job");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Get OCR job status by job ID
  app.get("/api/v1/ocr/:jobId", {
    schema: {
      params: {
        type: "object",
        required: ["jobId"],
        properties: {
          jobId: { type: "string", format: "uuid" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { jobId } = request.params as { jobId: string };
      const job = await getOcrJob(jobId);
      if (!job) {
        return send404(reply, "NOT_FOUND", "OCR job not found");
      }
      return job;
    } catch (err: unknown) {
      request.log.error(err, "Failed to get OCR job");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Get all OCR jobs for a document / evidence item
  app.get("/api/v1/ocr/evidence/:evidenceId", {
    schema: {
      params: {
        type: "object",
        required: ["evidenceId"],
        properties: {
          evidenceId: { type: "string", format: "uuid" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { evidenceId } = request.params as { evidenceId: string };
      const jobs = await getOcrJobsByEvidence(evidenceId);
      return { jobs };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get OCR jobs for evidence");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });
}
