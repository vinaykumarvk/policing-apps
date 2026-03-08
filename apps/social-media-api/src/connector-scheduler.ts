import { query, getClient } from "./db";
import { logInfo, logWarn, logError } from "./logger";
import { createRetryHandler, createDeadLetterQueue } from "@puda/api-integrations";
import { RedditConnector } from "./connectors/reddit";
import { YouTubeConnector } from "./connectors/youtube";
import { TwitterConnector } from "./connectors/twitter";
import { InstagramConnector } from "./connectors/instagram";
import { FacebookConnector } from "./connectors/facebook";
import { ApifyConnector } from "./connectors/apify-connector";
import { ingestItems } from "./connectors/ingestion-pipeline";
import { buildLocationTermSet, filterByJurisdiction, findJurisdictionMatches } from "./services/jurisdiction-filter";
import type { PlatformConnector, FetchedItem } from "./connectors/types";
import type { JurisdictionRow } from "./services/jurisdiction-filter";

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

  // Platforms routed exclusively through Apify — skip native connector registration
  const apifyOnlyPlatforms = new Set(
    (process.env.APIFY_ONLY_PLATFORMS || "twitter,instagram,facebook")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );

  connectors.set("reddit", new RedditConnector());

  const ytKey = process.env.YOUTUBE_API_KEY;
  if (ytKey) {
    connectors.set("youtube", new YouTubeConnector(ytKey));
  } else {
    logWarn("YouTube connector disabled — YOUTUBE_API_KEY not set");
  }

  if (!apifyOnlyPlatforms.has("twitter")) {
    const twToken = process.env.TWITTER_BEARER_TOKEN;
    if (twToken) {
      connectors.set("twitter", new TwitterConnector(twToken));
    } else {
      logWarn("Twitter connector disabled — TWITTER_BEARER_TOKEN not set");
    }
  } else {
    logInfo("Twitter routed via Apify — native connector skipped");
  }

  const metaToken = process.env.META_ACCESS_TOKEN;
  const igAccountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;

  if (!apifyOnlyPlatforms.has("instagram")) {
    if (metaToken && igAccountId) {
      connectors.set("instagram", new InstagramConnector(metaToken, igAccountId));
    } else {
      logWarn("Instagram connector disabled — META_ACCESS_TOKEN or INSTAGRAM_BUSINESS_ACCOUNT_ID not set");
    }
  } else {
    logInfo("Instagram routed via Apify — native connector skipped");
  }

  if (!apifyOnlyPlatforms.has("facebook")) {
    if (metaToken) {
      connectors.set("facebook", new FacebookConnector(metaToken));
    } else {
      logWarn("Facebook connector disabled — META_ACCESS_TOKEN not set");
    }
  } else {
    logInfo("Facebook routed via Apify — native connector skipped");
  }

  return connectors;
}

function initApifyConnector(): ApifyConnector | null {
  const token = process.env.APIFY_API_TOKEN;
  if (token) {
    logInfo("Apify connector enabled");
    return new ApifyConnector(token);
  }
  logWarn("Apify connector disabled — APIFY_API_TOKEN not set");
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runPollCycle(connectors: Map<string, PlatformConnector>, apify: ApifyConnector | null): Promise<void> {
  const client = await getClient();
  try {
    const lockResult = await client.query("SELECT pg_try_advisory_lock($1) AS acquired", [CONNECTOR_LOCK_ID]);
    if (!lockResult.rows[0]?.acquired) {
      return; // Another instance is already running the poll
    }

    try {
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

      // ═══════════════════════════════════════════════════════════════
      // PHASE A: Tier-1 — Profile scraping via Apify
      // ═══════════════════════════════════════════════════════════════
      if (apify) {
        try {
          const profileResult = await client.query(
            `SELECT profile_id, platform, entry_type, handle, url
             FROM monitoring_profile WHERE is_active = TRUE
             ORDER BY CASE priority WHEN 'HIGH' THEN 1 WHEN 'NORMAL' THEN 2 ELSE 3 END`,
          );

          if (profileResult.rows.length > 0) {
            // Group by platform + entry_type
            const groups = new Map<string, Array<{ handle?: string; url?: string; entryType: string; profileId: string }>>();
            for (const row of profileResult.rows) {
              const key = `${row.platform}:${row.entry_type}`;
              if (!groups.has(key)) groups.set(key, []);
              groups.get(key)!.push({ handle: row.handle, url: row.url, entryType: row.entry_type, profileId: row.profile_id });
            }

            const apifyConnectorId = dbConnectors.get("apify") || dbConnectors.get("facebook") || "";

            for (const [key, targets] of groups) {
              const platform = key.split(":")[0];
              try {
                const items = await apify.fetchByProfiles(platform, targets);
                // Tag as TIER_1
                for (const item of items) {
                  item.metadata = { ...item.metadata, source_tier: "TIER_1" };
                }
                if (items.length > 0) {
                  const result = await ingestItems(items, apifyConnectorId);
                  totalInserted += result.inserted;
                  totalDuplicates += result.duplicates;
                  totalAlerts += result.alertsCreated;
                }
                // Update last_scraped_at for these profiles
                const profileIds = targets.map((t) => t.profileId);
                await client.query(
                  `UPDATE monitoring_profile SET last_scraped_at = NOW(), updated_at = NOW()
                   WHERE profile_id = ANY($1::uuid[])`,
                  [profileIds],
                );
              } catch (err) {
                logError("Tier-1 Apify profile scrape failed", { platform, error: String(err) });
              }
              await sleep(2000);
            }

            logInfo("TIER_1_COMPLETE", { profiles: profileResult.rows.length });
          }
        } catch (err) {
          logError("Tier-1 phase failed", { error: String(err) });
        }
      }

      // ═══════════════════════════════════════════════════════════════
      // PHASE B: Load Tier-2 jurisdiction locations
      // ═══════════════════════════════════════════════════════════════
      let locationRows: JurisdictionRow[] = [];
      let locationTermSet: RegExp | null = null;
      try {
        const locResult = await client.query(
          `SELECT district_name, city_names, area_names, alt_spellings
           FROM jurisdiction_location WHERE is_active = TRUE`,
        );
        locationRows = locResult.rows as JurisdictionRow[];
        locationTermSet = buildLocationTermSet(locationRows);
        if (locationRows.length > 0) {
          logInfo("TIER_2_LOADED", { locations: locationRows.length });
        }
      } catch (err) {
        logError("Tier-2 location load failed", { error: String(err) });
      }

      // ═══════════════════════════════════════════════════════════════
      // PHASE C: Tier-3 — Keyword search (existing + Apify) + Tier-2 filtering
      // ═══════════════════════════════════════════════════════════════
      const watchlistResult = await client.query(
        "SELECT watchlist_id, keywords, platforms FROM watchlist WHERE is_active = TRUE",
      );

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
              let items = await retryHandler.execute(
                () => connector.fetchByKeyword(keyword),
                `${platform}:${keyword}`,
              );

              // Apply jurisdiction filter (Tier-2) to Tier-3 results
              items = applyJurisdictionFilter(items, locationTermSet, locationRows);

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

          // Additionally use Apify for facebook/instagram/twitter keyword search
          if (apify) {
            const apifyPlatforms = ["facebook", "instagram", "twitter"].filter((p) => platforms.includes(p));
            const apifyConnectorId = dbConnectors.get("apify") || "";
            for (const apifyPlatform of apifyPlatforms) {
              try {
                let items = await apify.fetchByKeywords(apifyPlatform, [keyword]);
                items = applyJurisdictionFilter(items, locationTermSet, locationRows);
                if (items.length > 0 && apifyConnectorId) {
                  const result = await ingestItems(items, apifyConnectorId);
                  totalInserted += result.inserted;
                  totalDuplicates += result.duplicates;
                  totalAlerts += result.alertsCreated;
                }
              } catch (err) {
                logError("Apify keyword search failed", { platform: apifyPlatform, keyword, error: String(err) });
              }
              await sleep(2000);
            }
          }
        }
      }

      // Update last_poll_at for active connectors
      for (const [platform, connectorId] of dbConnectors) {
        if (connectors.has(platform) || platform === "apify") {
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

/** Apply Tier-2 jurisdiction filtering to Tier-3 keyword results */
function applyJurisdictionFilter(
  items: FetchedItem[],
  locationTermSet: RegExp | null,
  locationRows: JurisdictionRow[],
): FetchedItem[] {
  const filtered = filterByJurisdiction(items, locationTermSet);
  // Tag passing items with TIER_3 metadata
  for (const item of filtered) {
    item.metadata = {
      ...item.metadata,
      source_tier: "TIER_3",
      ...(locationRows.length > 0
        ? { jurisdiction_match: findJurisdictionMatches(item.contentText, locationRows) }
        : {}),
    };
  }
  return filtered;
}

// ═══════════════════════════════════════════════════════════════
// Periodic compliance jobs (run on separate timers)
// ═══════════════════════════════════════════════════════════════
let complianceIntervalId: ReturnType<typeof setInterval> | null = null;
const COMPLIANCE_INTERVAL_MS = 3_600_000; // 1 hour

async function runComplianceJobs(): Promise<void> {
  try {
    // Phase 1: Retention check
    const { runRetentionCheck } = await import("./services/retention-enforcer");
    await runRetentionCheck();

    // Phase 2: Auto-escalation SLA check
    const { checkAndEscalate } = await import("./services/auto-escalation");
    await checkAndEscalate();

    // Phase 4: Trend spike detection + NPS flagging
    const { detectSpikes, flagNpsCandidates } = await import("./services/trend-analyzer");
    await detectSpikes();
    await flagNpsCandidates();

    logInfo("COMPLIANCE_JOBS_COMPLETE");
  } catch (err) {
    logError("Compliance jobs failed", { error: String(err) });
  }
}

export function startConnectorScheduler(): void {
  if (intervalId) return;

  const connectors = initConnectors();
  const apify = initApifyConnector();
  const platforms = Array.from(connectors.keys());
  logInfo("Connector scheduler started", { intervalMs: POLL_INTERVAL_MS, platforms, apifyEnabled: !!apify });

  intervalId = setInterval(() => {
    runPollCycle(connectors, apify);
  }, POLL_INTERVAL_MS);

  // Run first poll after a short delay to let the server finish startup
  setTimeout(() => runPollCycle(connectors, apify), 5000);

  // Start compliance jobs on hourly schedule
  complianceIntervalId = setInterval(runComplianceJobs, COMPLIANCE_INTERVAL_MS);
  setTimeout(runComplianceJobs, 30_000); // first run after 30s
}

export function stopConnectorScheduler(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  if (complianceIntervalId) {
    clearInterval(complianceIntervalId);
    complianceIntervalId = null;
  }
  logInfo("Connector scheduler stopped");
}
