import { query } from "../db";
import { logInfo, logError } from "../logger";
import { classifyContent } from "../services/classifier";
import { extractAndStore } from "../services/entity-extractor";
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

      // 2. Classify + confidence routing
      const classification = classifyContent(item.contentText);

      // FR-06: Route low-confidence results to NEEDS_REVIEW
      const CONFIDENCE_THRESHOLD = Number(process.env.CLASSIFICATION_CONFIDENCE_THRESHOLD) || 60;
      const reviewStatus = classification.riskScore < CONFIDENCE_THRESHOLD && classification.riskScore >= ALERT_THREAT_THRESHOLD
        ? "NEEDS_REVIEW"
        : classification.riskScore >= CONFIDENCE_THRESHOLD ? "AUTO_ACCEPTED" : "AUTO_ACCEPTED";

      // 3. Insert content item
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

      // 3b. Insert classification result with review status
      try {
        await query(
          `INSERT INTO classification_result (entity_type, entity_id, category, risk_score, risk_factors, review_status)
           VALUES ('content_item', $1, $2, $3, $4, $5)
           ON CONFLICT (entity_type, entity_id) DO UPDATE SET risk_score = EXCLUDED.risk_score, review_status = EXCLUDED.review_status, updated_at = NOW()`,
          [contentId, classification.category, classification.riskScore, JSON.stringify(classification.factors || []), reviewStatus],
        );
      } catch (err) {
        logError("Classification result insert failed", { contentId, error: String(err) });
      }

      // 4. Extract entities (non-blocking — log errors but don't fail)
      try {
        await extractAndStore("content_item", contentId, item.contentText);
      } catch (err) {
        logError("Entity extraction failed for content", { contentId, error: String(err) });
      }

      // 5. Actor repeat-offender auto-CRITICAL (FR-07)
      let actorRepeatOffender = false;
      if (item.authorHandle && item.platform) {
        try {
          const actorResult = await query(
            `SELECT actor_id, total_flagged_posts, is_repeat_offender FROM actor_account
             WHERE handles @> $1::jsonb`,
            [JSON.stringify([{ platform: item.platform, handle: item.authorHandle }])],
          );
          if (actorResult.rows.length > 0) {
            const actor = actorResult.rows[0];
            if (actor.is_repeat_offender || (actor.total_flagged_posts || 0) >= 3) {
              actorRepeatOffender = true;
            }
            // Link content to actor
            await query(
              `UPDATE content_item SET actor_id = $1 WHERE content_id = $2`,
              [actor.actor_id, contentId],
            );
          }
        } catch (err) {
          logError("Actor lookup failed", { contentId, error: String(err) });
        }
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

          await query(
            `INSERT INTO sm_alert
               (alert_type, priority, title, description, content_id, state_id,
                alert_ref)
             VALUES
               ('AUTO_DETECTED', $1, $2, $3, $4, 'NEW',
                'SM-ALERT-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('sm_alert_ref_seq')::text, 6, '0'))`,
            [
              priority,
              `[${classification.category}] ${item.platform} — ${(item.contentText || "").slice(0, 100)}`,
              `Auto-detected ${classification.category} content from ${item.platform}. Risk score: ${classification.riskScore}. Author: ${item.authorHandle || "unknown"}. URL: ${item.contentUrl}`,
              contentId,
            ],
          );
          alertsCreated++;
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
