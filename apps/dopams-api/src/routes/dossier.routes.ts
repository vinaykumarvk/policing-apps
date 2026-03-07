import { FastifyInstance } from "fastify";
import { send400, send404, sendError } from "../errors";
import {
  listDossiers,
  getDossier,
  createDossier,
  assembleDossier,
  exportDossier,
  exportDossierPdfWithWatermark,
} from "../services/dossier";

export async function registerDossierRoutes(app: FastifyInstance): Promise<void> {
  // ---------------------------------------------------------------------------
  // GET /api/v1/dossiers — paginated list with optional filters
  // ---------------------------------------------------------------------------
  app.get(
    "/api/v1/dossiers",
    {
      schema: {
        tags: ["dossiers"],
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            subject_id: { type: "string", format: "uuid" },
            state_id: { type: "string", maxLength: 50 },
            limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
            offset: { type: "integer", minimum: 0, default: 0 },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { subject_id, state_id, limit: rawLimit, offset: rawOffset } =
          request.query as Record<string, string | undefined>;

        const limit = Math.min(Math.max(parseInt(rawLimit || "50", 10) || 50, 1), 200);
        const offset = Math.max(parseInt(rawOffset || "0", 10) || 0, 0);

        const { dossiers, total } = await listDossiers({
          subjectId: subject_id || null,
          stateId: state_id || null,
          limit,
          offset,
        });

        return { dossiers, total, limit, offset };
      } catch (err: unknown) {
        request.log.error(err, "Failed to list dossiers");
        return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
      }
    },
  );

  // ---------------------------------------------------------------------------
  // GET /api/v1/dossiers/:id — detail with content_sections
  // ---------------------------------------------------------------------------
  app.get(
    "/api/v1/dossiers/:id",
    {
      schema: {
        tags: ["dossiers"],
        params: {
          type: "object",
          additionalProperties: false,
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const dossier = await getDossier(id);
        if (!dossier) {
          return send404(reply, "DOSSIER_NOT_FOUND", "Dossier not found");
        }
        return { dossier };
      } catch (err: unknown) {
        request.log.error(err, "Failed to get dossier");
        return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
      }
    },
  );

  // ---------------------------------------------------------------------------
  // POST /api/v1/dossiers — create a new dossier
  // ---------------------------------------------------------------------------
  app.post(
    "/api/v1/dossiers",
    {
      schema: {
        tags: ["dossiers"],
        body: {
          type: "object",
          additionalProperties: false,
          required: ["title"],
          properties: {
            title: { type: "string", minLength: 1, maxLength: 255 },
            subjectId: { type: "string", format: "uuid" },
            caseId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { title, subjectId, caseId } = request.body as {
          title: string;
          subjectId?: string;
          caseId?: string;
        };
        const userId = request.authUser!.userId;

        const dossier = await createDossier({ title, subjectId, caseId, userId });
        reply.code(201);
        return { dossier };
      } catch (err: unknown) {
        request.log.error(err, "Failed to create dossier");
        return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
      }
    },
  );

  // ---------------------------------------------------------------------------
  // POST /api/v1/dossiers/:id/assemble — trigger assembly
  // ---------------------------------------------------------------------------
  app.post(
    "/api/v1/dossiers/:id/assemble",
    {
      schema: {
        tags: ["dossiers"],
        params: {
          type: "object",
          additionalProperties: false,
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };

        // Verify dossier exists before assembling
        const dossier = await getDossier(id);
        if (!dossier) {
          return send404(reply, "DOSSIER_NOT_FOUND", "Dossier not found");
        }

        const result = await assembleDossier(id);
        return { success: true, dossier: result };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === "DOSSIER_NOT_FOUND") {
          return send404(reply, "DOSSIER_NOT_FOUND", "Dossier not found");
        }
        request.log.error(err, "Failed to assemble dossier");
        return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
      }
    },
  );

  // ---------------------------------------------------------------------------
  // GET /api/v1/dossiers/:id/export — export as PDF or DOCX
  // ---------------------------------------------------------------------------
  app.get(
    "/api/v1/dossiers/:id/export",
    {
      schema: {
        tags: ["dossiers"],
        params: {
          type: "object",
          additionalProperties: false,
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            format: { type: "string", enum: ["PDF", "DOCX"], default: "PDF" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const { format: rawFormat } = request.query as { format?: string };
        const format = (rawFormat === "DOCX" ? "DOCX" : "PDF") as "PDF" | "DOCX";

        const { buffer, contentType } = await exportDossier(id, format);

        const filename = `dossier-${id}.${format === "PDF" ? "pdf" : "docx"}`;
        reply
          .header("Content-Type", contentType)
          .header("Content-Disposition", `attachment; filename="${filename}"`)
          .header("Content-Length", buffer.length);

        return reply.send(buffer);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === "DOSSIER_NOT_FOUND") {
          return send404(reply, "DOSSIER_NOT_FOUND", "Dossier not found");
        }
        if (message === "DOSSIER_NOT_ASSEMBLED") {
          return send400(reply, "DOSSIER_NOT_ASSEMBLED", "Dossier must be assembled before export");
        }
        request.log.error(err, "Failed to export dossier");
        return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
      }
    },
  );

  // ---------------------------------------------------------------------------
  // GET /api/v1/dossiers/:id/pdf — FR-09: export PDF with user-specific watermark
  // ---------------------------------------------------------------------------
  app.get(
    "/api/v1/dossiers/:id/pdf",
    {
      schema: {
        tags: ["dossiers"],
        params: {
          type: "object",
          additionalProperties: false,
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const username = request.authUser?.userId || "unknown";

        const { buffer } = await exportDossierPdfWithWatermark(id, username);

        const filename = `dossier-${id}.pdf`;
        reply
          .header("Content-Type", "application/pdf")
          .header("Content-Disposition", `attachment; filename="${filename}"`)
          .header("Content-Length", buffer.length);

        return reply.send(buffer);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === "DOSSIER_NOT_FOUND") {
          return send404(reply, "DOSSIER_NOT_FOUND", "Dossier not found");
        }
        if (message === "DOSSIER_NOT_ASSEMBLED") {
          return send400(reply, "DOSSIER_NOT_ASSEMBLED", "Dossier must be assembled before export");
        }
        request.log.error(err, "Failed to export dossier PDF");
        return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
      }
    },
  );
}
