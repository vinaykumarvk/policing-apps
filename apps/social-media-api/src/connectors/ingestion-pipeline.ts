import { query } from "../db";
import { logInfo, logError } from "../logger";
import { classifyContentWithLlm } from "../services/classifier";
import { translateText } from "../services/translator";
import { extractAndStore } from "../services/entity-extractor";
import { enqueueScreenshot, isScreenshotServiceReady } from "../services/screenshot-capture";
import { autoRedactNonTargetPii, logRedactions } from "../services/pii-minimizer";
import { recordDetection } from "../services/trend-analyzer";
import { autoMapEntityWithRules } from "../services/legal-rule-evaluator";
import type { FetchedItem } from "./types";

const ALERT_THREAT_THRESHOLD = Number(process.env.ALERT_THREAT_THRESHOLD) || 40;

export interface IngestionResult {
  inserted: number;
  duplicates: number;
  alertsCreated: number;
}

export async function ingestItems(
  items: FetchedItem[],
  connectorId: string,
): Promise<IngestionResult> {
  let inserted = 0;
  let duplicates = 0;
  let alertsCreated = 0;

  for (const item of items) {
    try {
      // 1. Dedupe check
      const existing = await query(
        "SELECT content_id FROM content_item WHERE platform = $1 AND platform_post_id = $2",
        [item.platform, item.platformPostId],
      );
      if (existing.rows.length > 0) {
        duplicates++;
        continue;
      }

      // 2. Actor lookup BEFORE classification (FR-07) — feeds repeat-offender info into narcotics scorer
      let actorRepeatOffender = false;
      let actorFlaggedPosts = 0;
      let actorId: string | null = null;
      if (item.authorHandle && item.platform) {
        try {
          const actorResult = await query(
            `SELECT actor_id, total_flagged_posts, is_repeat_offender FROM actor_account
             WHERE handles @> $1::jsonb`,
            [JSON.stringify([{ platform: item.platform, handle: item.authorHandle }])],
          );
          if (actorResult.rows.length > 0) {
            const actor = actorResult.rows[0];
            actorId = actor.actor_id;
            actorFlaggedPosts = actor.total_flagged_posts || 0;
            if (actor.is_repeat_offender || actorFlaggedPosts >= 3) {
              actorRepeatOffender = true;
            }
          }
        } catch (err) {
          logError("Actor lookup failed", { error: String(err) });
        }
      }

      // 3. LLM-enhanced classification (LLM first, rules fallback)
      const classification = await classifyContentWithLlm(
        item.contentText,
        actorFlaggedPosts,
        actorRepeatOffender,
      );

      // FR-06: Route low-confidence results to NEEDS_REVIEW
      const CONFIDENCE_THRESHOLD = Number(process.env.CLASSIFICATION_CONFIDENCE_THRESHOLD) || 60;
      const reviewStatus = classification.riskScore < CONFIDENCE_THRESHOLD && classification.riskScore >= ALERT_THREAT_THRESHOLD
        ? "NEEDS_REVIEW"
        : classification.riskScore >= CONFIDENCE_THRESHOLD ? "AUTO_ACCEPTED" : "AUTO_ACCEPTED";

      // 4. Insert content item
      const insertResult = await query(
        `INSERT INTO content_item
           (connector_id, platform, platform_post_id, author_handle, author_name,
            content_text, content_url, language, threat_score, metadata_jsonb, published_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING content_id`,
        [
          connectorId,
          item.platform,
          item.platformPostId,
          item.authorHandle,
          item.authorName,
          item.contentText,
          item.contentUrl,
          item.language,
          classification.riskScore,
          JSON.stringify(item.metadata),
          item.publishedAt,
        ],
      );
      const contentId = insertResult.rows[0].content_id as string;
      inserted++;

      // 4b. Link content to actor if found
      if (actorId) {
        try {
          await query(
            `UPDATE content_item SET actor_id = $1 WHERE content_id = $2`,
            [actorId, contentId],
          );
        } catch (err) {
          logError("Actor link failed", { contentId, error: String(err) });
        }
      }

      // 4c. Insert classification result with review status + LLM metadata
      try {
        await query(
          `INSERT INTO classification_result (entity_type, entity_id, category, risk_score, risk_factors, review_status, classified_by_llm, llm_confidence)
           VALUES ('content_item', $1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (entity_type, entity_id) DO UPDATE SET risk_score = EXCLUDED.risk_score, review_status = EXCLUDED.review_status, classified_by_llm = EXCLUDED.classified_by_llm, llm_confidence = EXCLUDED.llm_confidence, updated_at = NOW()`,
          [contentId, classification.category, classification.riskScore, JSON.stringify(classification.factors || []), reviewStatus, classification.llmUsed, classification.llmConfidence ?? null],
        );
      } catch (err) {
        logError("Classification result insert failed", { contentId, error: String(err) });
      }

      // 4d. Auto-redact non-target PII for non-OSINT content (Phase 3: Privacy)
      try {
        const piiResult = autoRedactNonTargetPii(item.contentText);
        if (piiResult.redactions.length > 0) {
          await query("UPDATE content_item SET content_text = $1, updated_at = NOW() WHERE content_id = $2", [piiResult.text, contentId]);
          await logRedactions(contentId, piiResult.redactions);
        }
      } catch (err) {
        logError("PII redaction failed", { contentId, error: String(err) });
      }

      // 4f. Auto-translate non-English content to English
      if (item.language && item.language !== "en") {
        try {
          await translateText({
            sourceEntityType: "content_item",
            sourceEntityId: contentId,
            text: item.contentText,
            targetLanguage: "en",
            detectedLang: item.language,
          });
        } catch (err) {
          logError("Auto-translation failed", { contentId, language: item.language, error: String(err) });
        }
      }

      // 4e. Record detections for trend analysis (Phase 4: Early Warning)
      try {
        if (classification.factors && Array.isArray(classification.factors)) {
          for (const factor of classification.factors) {
            await recordDetection("CLASSIFICATION_FACTOR", String(factor), classification.category, null);
          }
        }
        if (classification.category && classification.riskScore >= ALERT_THREAT_THRESHOLD) {
          await recordDetection("SUBSTANCE_CATEGORY", classification.category, classification.category, null);
        }
      } catch (err) {
        logError("Trend recording failed", { contentId, error: String(err) });
      }

      // 5. Extract entities (non-blocking — log errors but don't fail)
      try {
        await extractAndStore("content_item", contentId, item.contentText);
      } catch (err) {
        logError("Entity extraction failed for content", { contentId, error: String(err) });
      }

      // 6. Auto-alert if risk score exceeds threshold
      if (classification.riskScore >= ALERT_THREAT_THRESHOLD) {
        try {
          let priority = classification.riskScore >= 85 ? "CRITICAL"
            : classification.riskScore >= 70 ? "HIGH"
            : classification.riskScore >= 50 ? "MEDIUM"
            : "LOW";

          // Escalate to CRITICAL if repeat offender with 3+ flagged posts
          if (actorRepeatOffender && priority !== "CRITICAL") {
            priority = "CRITICAL";
          }

          const targetedPrefix = item.metadata?.source_tier === "TIER_1" ? "[TARGETED] " : "";

          const alertInsertResult = await query(
            `INSERT INTO sm_alert
               (alert_type, priority, title, description, content_id, state_id,
                alert_ref)
             VALUES
               ('AUTO_DETECTED', $1, $2, $3, $4, 'NEW',
                'SM-ALERT-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('sm_alert_ref_seq')::text, 6, '0'))
             RETURNING alert_id`,
            [
              priority,
              `${targetedPrefix}[${classification.category}] ${item.platform} — ${(item.contentText || "").slice(0, 100)}`,
              `Auto-detected ${classification.category} content from ${item.platform}. Risk score: ${classification.riskScore}. Author: ${item.authorHandle || "unknown"}. URL: ${item.contentUrl}`,
              contentId,
            ],
          );
          alertsCreated++;

          // Auto-screenshot capture for high-threat posts
          if (item.contentUrl && isScreenshotServiceReady()) {
            enqueueScreenshot(contentId, item.contentUrl, connectorId);
          }

          // Auto legal mapping using rule engine — non-blocking for both alert and content
          try {
            const alertId = alertInsertResult.rows[0].alert_id as string;
            await autoMapEntityWithRules("sm_alert", alertId);
          } catch (legalErr) {
            logError("Legal auto-mapping failed for alert", { contentId, error: String(legalErr) });
          }
          // Also map the content item for broader statute coverage
          Promise.resolve().then(() =>
            autoMapEntityWithRules("content_item", contentId),
          ).catch((mapErr) => {
            logError("Legal auto-mapping failed for content", { contentId, error: String(mapErr) });
          });
        } catch (err) {
          logError("Auto-alert creation failed", { contentId, error: String(err) });
        }
      }
    } catch (err) {
      logError("Ingestion failed for item", { platformPostId: item.platformPostId, error: String(err) });
    }
  }

  if (inserted > 0 || alertsCreated > 0) {
    logInfo("Ingestion batch complete", { inserted, duplicates, alertsCreated });
  }

  return { inserted, duplicates, alertsCreated };
}
