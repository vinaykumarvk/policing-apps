import { query, getClient } from "./db";
import { logInfo, logWarn, logError } from "./logger";
import { createRetryHandler, createDeadLetterQueue } from "@puda/api-integrations";
import { RedditConnector } from "./connectors/reddit";
import { YouTubeConnector } from "./connectors/youtube";
import { TwitterConnector } from "./connectors/twitter";
import { InstagramConnector } from "./connectors/instagram";
import { FacebookConnector } from "./connectors/facebook";
import { ingestItems } from "./connectors/ingestion-pipeline";
import type { PlatformConnector } from "./connectors/types";

const retryHandler = createRetryHandler({
  maxRetries: 3,
  baseDelayMs: 2000,
  maxDelayMs: 30000,
});

const deadLetterQueue = createDeadLetterQueue({
  queryFn: query,
  tableName: "connector_dead_letter",
});

export { deadLetterQueue };

const CONNECTOR_LOCK_ID = 900_004;
const POLL_INTERVAL_MS = Number(process.env.CONNECTOR_POLL_INTERVAL_MS) || 300_000;

let intervalId: ReturnType<typeof setInterval> | null = null;

function initConnectors(): Map<string, PlatformConnector> {
  const connectors = new Map<string, PlatformConnector>();

  connectors.set("reddit", new RedditConnector());

  const ytKey = process.env.YOUTUBE_API_KEY;
  if (ytKey) {
    connectors.set("youtube", new YouTubeConnector(ytKey));
  } else {
    logWarn("YouTube connector disabled — YOUTUBE_API_KEY not set");
  }

  const twToken = process.env.TWITTER_BEARER_TOKEN;
  if (twToken) {
    connectors.set("twitter", new TwitterConnector(twToken));
  } else {
    logWarn("Twitter connector disabled — TWITTER_BEARER_TOKEN not set");
  }

  const metaToken = process.env.META_ACCESS_TOKEN;
  const igAccountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  if (metaToken && igAccountId) {
    connectors.set("instagram", new InstagramConnector(metaToken, igAccountId));
  } else {
    logWarn("Instagram connector disabled — META_ACCESS_TOKEN or INSTAGRAM_BUSINESS_ACCOUNT_ID not set");
  }

  if (metaToken) {
    connectors.set("facebook", new FacebookConnector(metaToken));
  } else {
    logWarn("Facebook connector disabled — META_ACCESS_TOKEN not set");
  }

  return connectors;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runPollCycle(connectors: Map<string, PlatformConnector>): Promise<void> {
  const client = await getClient();
  try {
    const lockResult = await client.query("SELECT pg_try_advisory_lock($1) AS acquired", [CONNECTOR_LOCK_ID]);
    if (!lockResult.rows[0]?.acquired) {
      return; // Another instance is already running the poll
    }

    try {
      // Read active watchlists
      const watchlistResult = await client.query(
        "SELECT watchlist_id, keywords, platforms FROM watchlist WHERE is_active = TRUE",
      );
      if (watchlistResult.rows.length === 0) {
        return;
      }

      // Read active connectors from DB
      const connectorResult = await client.query(
        "SELECT connector_id, platform FROM source_connector WHERE is_active = TRUE",
      );
      const dbConnectors = new Map<string, string>(); // platform -> connector_id
      for (const row of connectorResult.rows) {
        dbConnectors.set(row.platform, row.connector_id);
      }

      let totalInserted = 0;
      let totalDuplicates = 0;
      let totalAlerts = 0;

      for (const watchlist of watchlistResult.rows) {
        const keywords: string[] = Array.isArray(watchlist.keywords)
          ? watchlist.keywords
          : JSON.parse(watchlist.keywords || "[]");
        const platforms: string[] = Array.isArray(watchlist.platforms)
          ? watchlist.platforms
          : JSON.parse(watchlist.platforms || "[]");

        for (const keyword of keywords) {
          for (const platform of platforms) {
            const connector = connectors.get(platform);
            const connectorId = dbConnectors.get(platform);
            if (!connector || !connectorId) continue;

            try {
              // Check if connector is in backoff period
              const backoffCheck = await client.query(
                "SELECT backoff_until FROM source_connector WHERE connector_id = $1 AND backoff_until > NOW()",
                [connectorId],
              );
              if (backoffCheck.rows.length > 0) {
                logWarn("Connector in backoff", { platform, until: backoffCheck.rows[0].backoff_until });
                continue;
              }

              // Use retry handler with exponential backoff
              const items = await retryHandler.execute(
                () => connector.fetchByKeyword(keyword),
                `${platform}:${keyword}`,
              );
              if (items.length > 0) {
                const result = await ingestItems(items, connectorId);
                totalInserted += result.inserted;
                totalDuplicates += result.duplicates;
                totalAlerts += result.alertsCreated;
              }

              // Mark connector healthy on success
              await client.query(
                `UPDATE source_connector SET error_count = 0, health_status = 'HEALTHY', last_error = NULL, backoff_until = NULL
                 WHERE connector_id = $1`,
                [connectorId],
              );
            } catch (err) {
              logError("Connector fetch failed", { platform, keyword, error: String(err) });

              // Increment error count and set health status
              await client.query(
                `UPDATE source_connector SET error_count = error_count + 1, last_error = $1,
                  health_status = CASE WHEN error_count >= 5 THEN 'DOWN' WHEN error_count >= 2 THEN 'DEGRADED' ELSE health_status END,
                  backoff_until = CASE WHEN error_count >= 3 THEN NOW() + (INTERVAL '1 minute' * POWER(2, LEAST(error_count, 8))) ELSE backoff_until END
                 WHERE connector_id = $2`,
                [String(err), connectorId],
              );

              // Enqueue to dead letter after max retries
              try {
                await deadLetterQueue.enqueue(
                  { externalId: `${platform}-${keyword}-${Date.now()}`, source: platform, contentType: "fetch_error", rawData: { keyword, error: String(err) }, fetchedAt: new Date() },
                  String(err),
                  platform,
                );
              } catch (dlqErr) {
                logError("DLQ enqueue failed", { error: String(dlqErr) });
              }
            }

            // Rate limit: wait between API calls
            await sleep(1500);
          }
        }
      }

      // Update last_poll_at for active connectors
      for (const [platform, connectorId] of dbConnectors) {
        if (connectors.has(platform)) {
          await client.query(
            "UPDATE source_connector SET last_poll_at = NOW(), updated_at = NOW() WHERE connector_id = $1",
            [connectorId],
          );
        }
      }

      logInfo("POLL_CYCLE_COMPLETE", {
        inserted: totalInserted,
        duplicates: totalDuplicates,
        alertsCreated: totalAlerts,
        watchlists: watchlistResult.rows.length,
      });
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [CONNECTOR_LOCK_ID]);
    }
  } catch (err) {
    logError("Connector poll cycle failed", { error: String(err) });
  } finally {
    client.release();
  }
}

export function startConnectorScheduler(): void {
  if (intervalId) return;

  const connectors = initConnectors();
  const platforms = Array.from(connectors.keys());
  logInfo("Connector scheduler started", { intervalMs: POLL_INTERVAL_MS, platforms });

  intervalId = setInterval(() => {
    runPollCycle(connectors);
  }, POLL_INTERVAL_MS);

  // Run first poll after a short delay to let the server finish startup
  setTimeout(() => runPollCycle(connectors), 5000);
}

export function stopConnectorScheduler(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logInfo("Connector scheduler stopped");
  }
}
