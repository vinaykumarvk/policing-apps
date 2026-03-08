/**
 * Integration test for the social-media monitoring pipeline.
 *
 * Usage:
 *   npx tsx apps/social-media-api/scripts/test-integration.ts [platform ...]
 *
 * Examples:
 *   npx tsx apps/social-media-api/scripts/test-integration.ts              # all platforms
 *   npx tsx apps/social-media-api/scripts/test-integration.ts reddit youtube
 *   npx tsx apps/social-media-api/scripts/test-integration.ts twitter      # requires APIFY_API_KEY
 */
import { query, pool } from "../src/db";
import { RedditConnector } from "../src/connectors/reddit";
import { YouTubeConnector } from "../src/connectors/youtube";
import { ApifyConnector } from "../src/connectors/apify-connector";
import { ingestItems } from "../src/connectors/ingestion-pipeline";
import type { FetchedItem } from "../src/connectors/types";

const SEARCH_KEYWORD = process.env.TEST_KEYWORD || "drugs punjab";

// ── Helpers ──────────────────────────────────────────────────────────

function log(msg: string) {
  console.log(`[TEST] ${msg}`);
}

function logTable(label: string, rows: Record<string, unknown>[]) {
  console.log(`\n── ${label} ──`);
  if (rows.length === 0) {
    console.log("  (none)");
    return;
  }
  console.table(rows);
}

async function ensureConnectorRows() {
  const connectors = ["reddit", "youtube", "twitter", "instagram", "facebook", "apify"];
  for (const platform of connectors) {
    await query(
      `INSERT INTO source_connector (platform, connector_type, config_jsonb, is_active)
       SELECT $1::varchar, 'Polling'::varchar, '{}'::jsonb, true
       WHERE NOT EXISTS (SELECT 1 FROM source_connector WHERE platform = $1::varchar)`,
      [platform],
    );
  }
  log("source_connector rows ensured");
}

async function getConnectorId(platform: string): Promise<string> {
  const result = await query(
    "SELECT connector_id FROM source_connector WHERE platform = $1 LIMIT 1",
    [platform],
  );
  return result.rows[0]?.connector_id || "";
}

// ── Platform fetchers ────────────────────────────────────────────────

async function fetchReddit(keyword: string): Promise<FetchedItem[]> {
  log(`Fetching Reddit for "${keyword}"...`);
  const connector = new RedditConnector();
  const items = await connector.fetchByKeyword(keyword);
  log(`Reddit: ${items.length} items fetched`);
  return items;
}

async function fetchYouTube(keyword: string): Promise<FetchedItem[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    log("YouTube SKIPPED — YOUTUBE_API_KEY not set");
    return [];
  }
  log(`Fetching YouTube for "${keyword}"...`);
  const connector = new YouTubeConnector(apiKey);
  const items = await connector.fetchByKeyword(keyword);
  log(`YouTube: ${items.length} items fetched`);
  return items;
}

async function fetchApifyPlatform(platform: string, keyword: string): Promise<FetchedItem[]> {
  const token = process.env.APIFY_API_TOKEN || process.env.APIFY_API_KEY;
  if (!token) {
    log(`${platform} via Apify SKIPPED — APIFY_API_TOKEN / APIFY_API_KEY not set`);
    return [];
  }
  log(`Fetching ${platform} via Apify for "${keyword}"...`);
  const connector = new ApifyConnector(token);
  const items = await connector.fetchByKeywords(platform, [keyword]);
  log(`${platform} (Apify): ${items.length} items fetched`);
  return items;
}

// ── Main ─────────────────────────────────────────────────────────────

const ALL_PLATFORMS = ["reddit", "youtube", "twitter", "instagram", "facebook"] as const;

type Platform = (typeof ALL_PLATFORMS)[number];

const FETCHERS: Record<Platform, (kw: string) => Promise<FetchedItem[]>> = {
  reddit: fetchReddit,
  youtube: fetchYouTube,
  twitter: (kw) => fetchApifyPlatform("twitter", kw),
  instagram: (kw) => fetchApifyPlatform("instagram", kw),
  facebook: (kw) => fetchApifyPlatform("facebook", kw),
};

async function main() {
  const args = process.argv.slice(2).map((s) => s.toLowerCase());
  const platforms: Platform[] =
    args.length > 0
      ? (args.filter((a) => ALL_PLATFORMS.includes(a as Platform)) as Platform[])
      : [...ALL_PLATFORMS];

  if (platforms.length === 0) {
    console.error("No valid platforms specified. Choose from:", ALL_PLATFORMS.join(", "));
    process.exit(1);
  }

  log(`Platforms: ${platforms.join(", ")}`);
  log(`Keyword:   "${SEARCH_KEYWORD}"`);
  log(`Threshold: ${process.env.ALERT_THREAT_THRESHOLD || "40 (default)"}`);
  log("");

  // Ensure DB connector rows exist
  await ensureConnectorRows();

  // Fetch from each platform
  const allItems: FetchedItem[] = [];
  for (const platform of platforms) {
    try {
      const items = await FETCHERS[platform](SEARCH_KEYWORD);
      allItems.push(...items);
    } catch (err) {
      log(`ERROR fetching ${platform}: ${err}`);
    }
  }

  log(`\nTotal fetched: ${allItems.length} items`);
  if (allItems.length === 0) {
    log("Nothing to ingest — exiting.");
    await pool.end();
    return;
  }

  // Preview first 3 items
  log("\nSample items:");
  for (const item of allItems.slice(0, 3)) {
    console.log(`  [${item.platform}] ${item.authorHandle || "?"}: ${item.contentText.slice(0, 120)}...`);
  }

  // Determine connector IDs for ingestion
  // Native platforms use their own connector_id; Apify platforms use the "apify" connector_id
  const apifyPlatforms = new Set(["twitter", "instagram", "facebook"]);
  const apifyConnectorId = await getConnectorId("apify");

  // Group items by connector_id for ingestion
  const byConnector = new Map<string, FetchedItem[]>();
  for (const item of allItems) {
    const connId = apifyPlatforms.has(item.platform)
      ? apifyConnectorId
      : await getConnectorId(item.platform);
    if (!connId) {
      log(`WARNING: no connector_id for platform "${item.platform}" — skipping`);
      continue;
    }
    if (!byConnector.has(connId)) byConnector.set(connId, []);
    byConnector.get(connId)!.push(item);
  }

  // Ingest
  let totalInserted = 0;
  let totalDuplicates = 0;
  let totalAlerts = 0;

  for (const [connectorId, items] of byConnector) {
    log(`Ingesting ${items.length} items (connector ${connectorId.slice(0, 8)}...)...`);
    const result = await ingestItems(items, connectorId);
    totalInserted += result.inserted;
    totalDuplicates += result.duplicates;
    totalAlerts += result.alertsCreated;
    log(`  → inserted=${result.inserted}, duplicates=${result.duplicates}, alerts=${result.alertsCreated}`);
  }

  log(`\n════════════════════════════════════════`);
  log(`INGESTION SUMMARY`);
  log(`  Inserted:   ${totalInserted}`);
  log(`  Duplicates: ${totalDuplicates}`);
  log(`  Alerts:     ${totalAlerts}`);
  log(`════════════════════════════════════════`);

  // Query DB for results
  try {
    const contentStats = await query(
      `SELECT platform, COUNT(*)::int AS count, AVG(threat_score)::int AS avg_score, MAX(threat_score)::int AS max_score
       FROM content_item GROUP BY platform ORDER BY count DESC`,
    );
    logTable("Content Items by Platform", contentStats.rows);

    const alertStats = await query(
      `SELECT priority, COUNT(*)::int AS count FROM sm_alert GROUP BY priority ORDER BY
       CASE priority WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END`,
    );
    logTable("Alerts by Priority", alertStats.rows);

    const evidenceStats = await query(
      `SELECT state_id, COUNT(*)::int AS count FROM evidence_item GROUP BY state_id`,
    );
    logTable("Evidence (Screenshots) by State", evidenceStats.rows);
  } catch (err) {
    log(`DB query for summary failed (tables may not exist yet): ${err}`);
  }

  log("\nNote: Screenshots require Chromium (Docker container). If running locally, screenshot queue will be skipped.");
}

main()
  .catch((err) => {
    console.error("[TEST] Fatal error:", err);
    process.exit(1);
  })
  .finally(() => pool.end());
