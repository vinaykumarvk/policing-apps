import { FastifyInstance } from "fastify";
import { query } from "../db";
import { send404, sendError } from "../errors";
import { createRoleGuard } from "@puda/api-core";

const MAX_PATTERN_LENGTH = 500;
const MAX_REGEX_TEST_LENGTH = 50_000;

/** Validate that a regex pattern compiles and is not excessively long. */
function validateRegexPattern(pattern: string): { valid: boolean; error?: string } {
  if (pattern.length > MAX_PATTERN_LENGTH) {
    return { valid: false, error: `Pattern exceeds maximum length of ${MAX_PATTERN_LENGTH} characters` };
  }
  try {
    new RegExp(pattern, "i");
  } catch (err) {
    return { valid: false, error: `Invalid regex: ${err instanceof Error ? err.message : String(err)}` };
  }
  return { valid: true };
}

const VALID_STATES = ["NEW", "REVIEWING", "ESCALATED", "CLOSED"] as const;
const STATE_TRANSITIONS: Record<string, string[]> = {
  NEW: ["REVIEWING", "CLOSED"],
  REVIEWING: ["ESCALATED", "CLOSED"],
  ESCALATED: ["REVIEWING", "CLOSED"],
  CLOSED: [],
};

export async function registerContentMonitoringRoutes(app: FastifyInstance): Promise<void> {
  const requireContentAction = createRoleGuard(["INTELLIGENCE_ANALYST", "SUPERVISORY_OFFICER", "ADMINISTRATOR"]);
  // POST /api/v1/content/ingest — batch ingest content items
  app.post("/api/v1/content/ingest", {
    schema: {
      tags: ["content-monitoring"],
      body: {
        type: "object",
        additionalProperties: false,
        required: ["items"],
        properties: {
          items: {
            type: "array",
            minItems: 1,
            maxItems: 100,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["sourcePlatform", "rawText"],
              properties: {
                sourcePlatform: { type: "string", maxLength: 100 },
                contentType: { type: "string", enum: ["TEXT", "IMAGE", "VIDEO", "AUDIO", "LINK"], default: "TEXT" },
                rawText: { type: "string" },
                mediaUrls: { type: "array", items: { type: "string" } },
                authorHandle: { type: "string", maxLength: 255 },
                capturedAt: { type: "string", format: "date-time" },
                classifiedCategory: { type: "string", maxLength: 100 },
                riskScore: { type: "number", minimum: 0, maximum: 100 },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { items } = request.body as { items: Array<{
        sourcePlatform: string; contentType?: string; rawText: string; mediaUrls?: string[];
        authorHandle?: string; capturedAt?: string; classifiedCategory?: string; riskScore?: number;
      }> };
      const userId = request.authUser?.userId || null;

      // Load active monitoring rules for auto-evaluation
      const rulesResult = await query(`SELECT rule_id, rule_type, pattern, platforms FROM monitoring_rule WHERE is_active = TRUE`);
      const rules = rulesResult.rows as Array<{ rule_id: string; rule_type: string; pattern: string; platforms: string[] | string }>;

      const inserted: any[] = [];
      let duplicateCount = 0;
      for (const item of items) {
        // FR-02 AC-02: Content dedup — skip exact duplicates by (source_platform, md5(raw_text), captured_at)
        const result = await query(
          `INSERT INTO content_item (source_platform, content_type, raw_text, media_urls, author_handle, captured_at, classified_category, risk_score, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT ON CONSTRAINT uq_content_dedup DO NOTHING
           RETURNING *`,
          [
            item.sourcePlatform,
            item.contentType || "TEXT",
            item.rawText,
            JSON.stringify(item.mediaUrls || []),
            item.authorHandle || null,
            item.capturedAt || null,
            item.classifiedCategory || null,
            item.riskScore ?? null,
            userId,
          ],
        );
        if (result.rows.length === 0) {
          duplicateCount++;
          continue;
        }

        const row = result.rows[0];

        // FR-19: Auto-evaluate monitoring rules on ingest
        for (const rule of rules) {
          try {
            const platforms = typeof rule.platforms === "string" ? JSON.parse(rule.platforms) : (rule.platforms || []);
            if (platforms.length > 0 && !platforms.includes(item.sourcePlatform)) continue;

            if (rule.pattern.length > MAX_PATTERN_LENGTH) continue;
            const regex = new RegExp(rule.pattern, "i");
            const testText = item.rawText.length > MAX_REGEX_TEST_LENGTH
              ? item.rawText.slice(0, MAX_REGEX_TEST_LENGTH)
              : item.rawText;
            if (regex.test(testText)) {
              // Match found — auto-transition to REVIEWING and bump risk_score
              await query(
                `UPDATE content_item SET state_id = 'REVIEWING',
                   risk_score = GREATEST(COALESCE(risk_score, 0) + 10, risk_score),
                   updated_at = NOW()
                 WHERE content_id = $1 AND state_id = 'NEW'`,
                [row.content_id],
              );
              row.state_id = "REVIEWING";
              break; // One rule match is enough
            }
          } catch {
            // Invalid regex pattern — skip silently
          }
        }

        inserted.push(row);
      }

      reply.code(201);
      return { ingested: inserted.length, duplicates: duplicateCount, items: inserted };
    } catch (err: unknown) {
      request.log.error(err, "Failed to ingest content");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // GET /api/v1/content — list content items
  app.get("/api/v1/content", {
    schema: {
      tags: ["content-monitoring"],
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          source_platform: { type: "string", maxLength: 100 },
          state_id: { type: "string", maxLength: 20 },
          classified_category: { type: "string", maxLength: 100 },
          min_risk_score: { type: "number" },
          limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
          offset: { type: "integer", minimum: 0, default: 0 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const qs = request.query as Record<string, string | undefined>;
      const limit = Math.min(Math.max(parseInt(qs.limit || "50", 10) || 50, 1), 200);
      const offset = Math.max(parseInt(qs.offset || "0", 10) || 0, 0);
      const minRisk = qs.min_risk_score ? parseFloat(qs.min_risk_score) : null;

      const result = await query(
        `SELECT content_id, source_platform, content_type, raw_text, media_urls, author_handle,
                captured_at, classified_category, risk_score, state_id, created_at,
                COUNT(*) OVER() AS total_count
         FROM content_item
         WHERE ($1::text IS NULL OR source_platform = $1)
           AND ($2::text IS NULL OR state_id = $2)
           AND ($3::text IS NULL OR classified_category = $3)
           AND ($4::numeric IS NULL OR risk_score >= $4::numeric)
         ORDER BY created_at DESC
         LIMIT $5 OFFSET $6`,
        [qs.source_platform || null, qs.state_id || null, qs.classified_category || null, minRisk, limit, offset],
      );

      const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
      return { content: result.rows.map(({ total_count, ...r }: any) => r), total };
    } catch (err: unknown) {
      request.log.error(err, "Failed to list content items");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // GET /api/v1/content/:id — get single content item
  app.get("/api/v1/content/:id", {
    schema: {
      tags: ["content-monitoring"],
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const result = await query(`SELECT * FROM content_item WHERE content_id = $1`, [id]);
      if (result.rows.length === 0) return send404(reply, "CONTENT_NOT_FOUND", "Content item not found");
      return { content: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get content item");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // POST /api/v1/content/:id/transition — workflow state transition
  app.post("/api/v1/content/:id/transition", {
    schema: {
      tags: ["content-monitoring"],
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: {
        type: "object",
        additionalProperties: false,
        required: ["targetState"],
        properties: {
          targetState: { type: "string", enum: [...VALID_STATES] },
          remarks: { type: "string" },
        },
      },
    },
  }, async (request, reply) => {
    if (!requireContentAction(request, reply)) return;
    try {
      const { id } = request.params as { id: string };
      const { targetState, remarks } = request.body as { targetState: string; remarks?: string };

      const current = await query(`SELECT state_id FROM content_item WHERE content_id = $1`, [id]);
      if (current.rows.length === 0) return send404(reply, "CONTENT_NOT_FOUND", "Content item not found");

      const currentState = current.rows[0].state_id;
      const allowed = STATE_TRANSITIONS[currentState] || [];
      if (!allowed.includes(targetState)) {
        return sendError(reply, 400, "INVALID_TRANSITION", `Cannot transition from ${currentState} to ${targetState}`);
      }

      await query(`UPDATE content_item SET state_id = $1, updated_at = NOW() WHERE content_id = $2`, [targetState, id]);

      return { success: true, previousState: currentState, newState: targetState };
    } catch (err: unknown) {
      request.log.error(err, "Failed to transition content item");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // GET /api/v1/content/dashboard — stats by platform/category
  app.get("/api/v1/content/dashboard", {
    schema: { tags: ["content-monitoring"] },
  }, async (request, reply) => {
    try {
      const byPlatform = await query(
        `SELECT source_platform, state_id, COUNT(*)::int AS count
         FROM content_item GROUP BY source_platform, state_id ORDER BY source_platform, state_id`,
      );
      const byCategory = await query(
        `SELECT classified_category, COUNT(*)::int AS count, AVG(risk_score)::numeric(5,2) AS avg_risk
         FROM content_item WHERE classified_category IS NOT NULL
         GROUP BY classified_category ORDER BY count DESC`,
      );
      const totals = await query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE state_id = 'NEW')::int AS new_count,
                COUNT(*) FILTER (WHERE state_id = 'REVIEWING')::int AS reviewing_count,
                COUNT(*) FILTER (WHERE state_id = 'ESCALATED')::int AS escalated_count,
                COUNT(*) FILTER (WHERE state_id = 'CLOSED')::int AS closed_count
         FROM content_item`,
      );

      return {
        totals: totals.rows[0],
        byPlatform: byPlatform.rows,
        byCategory: byCategory.rows,
      };
    } catch (err: unknown) {
      request.log.error(err, "Failed to get content dashboard");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  // ----- Monitoring Rules CRUD -----
  app.get("/api/v1/content/rules", {
    schema: { tags: ["content-monitoring"] },
  }, async (request, reply) => {
    try {
      const result = await query(`SELECT * FROM monitoring_rule WHERE is_active = TRUE ORDER BY created_at DESC`);
      return { rules: result.rows };
    } catch (err: unknown) {
      request.log.error(err, "Failed to list monitoring rules");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  app.post("/api/v1/content/rules", {
    schema: {
      tags: ["content-monitoring"],
      body: {
        type: "object",
        additionalProperties: false,
        required: ["ruleType", "pattern"],
        properties: {
          ruleType: { type: "string", maxLength: 50 },
          pattern: { type: "string" },
          platforms: { type: "array", items: { type: "string" } },
        },
      },
    },
  }, async (request, reply) => {
    if (!requireContentAction(request, reply)) return;
    try {
      const { ruleType, pattern, platforms } = request.body as { ruleType: string; pattern: string; platforms?: string[] };
      const userId = request.authUser?.userId || null;

      const validation = validateRegexPattern(pattern);
      if (!validation.valid) {
        return sendError(reply, 400, "INVALID_PATTERN", validation.error || "Invalid regex pattern");
      }

      const result = await query(
        `INSERT INTO monitoring_rule (rule_type, pattern, platforms, created_by) VALUES ($1, $2, $3, $4) RETURNING *`,
        [ruleType, pattern, JSON.stringify(platforms || []), userId],
      );
      reply.code(201);
      return { rule: result.rows[0] };
    } catch (err: unknown) {
      request.log.error(err, "Failed to create monitoring rule");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });

  app.delete("/api/v1/content/rules/:id", {
    schema: {
      tags: ["content-monitoring"],
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
    },
  }, async (request, reply) => {
    if (!requireContentAction(request, reply)) return;
    try {
      const { id } = request.params as { id: string };
      const result = await query(`UPDATE monitoring_rule SET is_active = FALSE WHERE rule_id = $1 RETURNING rule_id`, [id]);
      if (result.rows.length === 0) return send404(reply, "RULE_NOT_FOUND", "Monitoring rule not found");
      return { success: true };
    } catch (err: unknown) {
      request.log.error(err, "Failed to delete monitoring rule");
      return sendError(reply, 500, "INTERNAL_ERROR", "An internal error occurred");
    }
  });
}
