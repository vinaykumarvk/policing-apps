import { FastifyInstance } from "fastify";
import { translateText, getTranslations } from "../services/translator";
import { query } from "../db";
import { sendError, send400, send404 } from "../errors";

export async function registerTranslateRoutes(app: FastifyInstance): Promise<void> {
  // ── Translation Glossary CRUD ──

  app.get("/api/v1/glossary", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          sourceLang: { type: "string", maxLength: 10 },
          targetLang: { type: "string", maxLength: 10 },
          domain: { type: "string", maxLength: 100 },
          limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
          offset: { type: "integer", minimum: 0, default: 0 },
        },
      },
    },
  }, async (request) => {
    const qs = request.query as Record<string, string | undefined>;
    const limit = Math.min(parseInt(qs.limit || "50", 10) || 50, 200);
    const offset = Math.max(parseInt(qs.offset || "0", 10) || 0, 0);
    const result = await query(
      `SELECT term_id, source_lang, target_lang, source_term, target_term, domain, created_by, created_at,
              COUNT(*) OVER() AS total_count
       FROM translation_glossary
       WHERE is_active = TRUE
         AND ($1::text IS NULL OR source_lang = $1)
         AND ($2::text IS NULL OR target_lang = $2)
         AND ($3::text IS NULL OR domain = $3)
       ORDER BY source_term
       LIMIT $4 OFFSET $5`,
      [qs.sourceLang || null, qs.targetLang || null, qs.domain || null, limit, offset],
    );
    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
    return { glossary: result.rows.map(({ total_count, ...r }: any) => r), total };
  });

  app.post("/api/v1/glossary", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["sourceLang", "targetLang", "sourceTerm", "targetTerm"],
        properties: {
          sourceLang: { type: "string", maxLength: 10 },
          targetLang: { type: "string", maxLength: 10 },
          sourceTerm: { type: "string" },
          targetTerm: { type: "string" },
          domain: { type: "string", maxLength: 100 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { sourceLang, targetLang, sourceTerm, targetTerm, domain } = request.body as {
        sourceLang: string; targetLang: string; sourceTerm: string; targetTerm: string; domain?: string;
      };
      const { userId } = request.authUser!;
      const result = await query(
        `INSERT INTO translation_glossary (source_lang, target_lang, source_term, target_term, domain, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (source_lang, target_lang, source_term, domain) WHERE is_active = TRUE
         DO UPDATE SET target_term = EXCLUDED.target_term, updated_at = NOW()
         RETURNING term_id, source_lang, target_lang, source_term, target_term, domain, created_at`,
        [sourceLang, targetLang, sourceTerm, targetTerm, domain || "general", userId],
      );
      reply.code(201);
      return { entry: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to create glossary entry");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  app.delete("/api/v1/glossary/:termId", {
    schema: { params: { type: "object", required: ["termId"], properties: { termId: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    const { termId } = request.params as { termId: string };
    const result = await query(
      `UPDATE translation_glossary SET is_active = FALSE, updated_at = NOW() WHERE term_id = $1 RETURNING term_id`,
      [termId],
    );
    if (result.rows.length === 0) return send404(reply, "TERM_NOT_FOUND", "Glossary term not found");
    return { success: true };
  });

  // ── Translation with glossary support ──

  app.post("/api/v1/translate", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["entityType", "entityId", "targetLanguage"],
        properties: {
          entityType: { type: "string" },
          entityId: { type: "string", format: "uuid" },
          targetLanguage: { type: "string" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { entityType, entityId, targetLanguage } = request.body as {
        entityType: string;
        entityId: string;
        targetLanguage: string;
      };

      let tableName: string;
      let textColumn: string;
      let idColumn: string;

      switch (entityType) {
        case "sm_alert":
          tableName = "sm_alert";
          textColumn = "description";
          idColumn = "alert_id";
          break;
        case "sm_case":
          tableName = "case_record";
          textColumn = "description";
          idColumn = "case_id";
          break;
        case "sm_evidence":
          tableName = "evidence_item";
          textColumn = "description";
          idColumn = "evidence_id";
          break;
        default:
          return send400(reply, "UNKNOWN_ENTITY_TYPE", `Unsupported entity type: ${entityType}`);
      }

      const entityResult = await query(
        `SELECT ${textColumn} FROM ${tableName} WHERE ${idColumn} = $1`,
        [entityId],
      );

      if (entityResult.rows.length === 0) {
        return send404(reply, "NOT_FOUND", "Entity not found");
      }

      let text = entityResult.rows[0][textColumn] || "";
      if (!text) {
        return send400(reply, "NO_TEXT", "Entity has no translatable text");
      }

      // Apply glossary substitutions before translation
      const glossary = await query(
        `SELECT source_term, target_term FROM translation_glossary
         WHERE target_lang = $1 AND is_active = TRUE
         ORDER BY LENGTH(source_term) DESC`,
        [targetLanguage],
      );
      for (const g of glossary.rows) {
        text = text.replace(new RegExp(g.source_term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), g.target_term);
      }

      const userId = request.authUser?.userId;

      // FR-09: Run language detection before translation and include metadata
      const { detectLanguageWithConfidence } = await import("../services/language-detector");
      const detection = detectLanguageWithConfidence(text);

      const result = await translateText({
        sourceEntityType: entityType,
        sourceEntityId: entityId,
        text,
        targetLanguage,
        createdBy: userId,
        detectedLang: detection.language,
        langConfidence: detection.confidence,
      });

      return {
        ...result,
        detectedLang: detection.language,
        langConfidence: detection.confidence,
      };
    } catch (err: unknown) {
      request.log.error(err, "Failed to translate text");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // Get translations for an entity
  app.get("/api/v1/translations/:entityType/:entityId", {
    schema: {
      params: {
        type: "object",
        required: ["entityType", "entityId"],
        properties: {
          entityType: { type: "string" },
          entityId: { type: "string", format: "uuid" },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { entityType, entityId } = request.params as { entityType: string; entityId: string };
      const translations = await getTranslations(entityType, entityId);
      return { translations };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get translations");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });
}
