import { logInfo, logError, logWarn } from "../logger";
import type { FetchedItem } from "./types";

const APIFY_BASE_URL = "https://api.apify.com/v2";
const POLL_INTERVAL_MS = 5_000;
const POLL_TIMEOUT_MS = 120_000;

/** Actor IDs by platform and mode */
const ACTOR_MAP: Record<string, { profile: string; keyword: string }> = {
  facebook: {
    profile: "apify/facebook-posts-scraper",
    keyword: "apify/facebook-posts-scraper",
  },
  instagram: {
    profile: "apify/instagram-profile-scraper",
    keyword: "apify/instagram-hashtag-scraper",
  },
  twitter: {
    profile: "apify/twitter-scraper",
    keyword: "apify/twitter-scraper",
  },
  x: {
    profile: "apify/twitter-scraper",
    keyword: "apify/twitter-scraper",
  },
};

interface ApifyTarget {
  handle?: string;
  url?: string;
  entryType: string;
}

export class ApifyConnector {
  private apiToken: string;

  constructor(apiToken: string) {
    this.apiToken = apiToken;
  }

  /**
   * Tier-1: Scrape specific profiles / groups / pages.
   */
  async fetchByProfiles(platform: string, targets: ApifyTarget[]): Promise<FetchedItem[]> {
    const actorEntry = ACTOR_MAP[platform];
    if (!actorEntry) {
      logWarn("Apify: unsupported platform for profile scraping", { platform });
      return [];
    }
    const actorId = actorEntry.profile;
    const input = this.buildProfileInput(platform, targets);
    return this.runActor(actorId, input, platform);
  }

  /**
   * Tier-3: Keyword search via Apify.
   */
  async fetchByKeywords(platform: string, keywords: string[]): Promise<FetchedItem[]> {
    const actorEntry = ACTOR_MAP[platform];
    if (!actorEntry) {
      logWarn("Apify: unsupported platform for keyword search", { platform });
      return [];
    }
    const actorId = actorEntry.keyword;
    const input = this.buildKeywordInput(platform, keywords);
    return this.runActor(actorId, input, platform);
  }

  private buildProfileInput(platform: string, targets: ApifyTarget[]): Record<string, unknown> {
    const urls = targets.map((t) => t.url || `https://${platform === "x" ? "twitter" : platform}.com/${t.handle}`);

    switch (platform) {
      case "facebook":
        return { startUrls: urls.map((u) => ({ url: u })), resultsLimit: 25 };
      case "instagram":
        return { directUrls: urls, resultsLimit: 25 };
      case "twitter":
      case "x": {
        const handles = targets.map((t) => t.handle).filter(Boolean);
        return handles.length > 0
          ? { handles, tweetsDesired: 25 }
          : { startUrls: urls.map((u) => ({ url: u })), tweetsDesired: 25 };
      }
      default:
        return { startUrls: urls.map((u) => ({ url: u })), resultsLimit: 25 };
    }
  }

  private buildKeywordInput(platform: string, keywords: string[]): Record<string, unknown> {
    switch (platform) {
      case "facebook":
        return { searchQueries: keywords, resultsLimit: 25 };
      case "instagram":
        return { hashtags: keywords, resultsLimit: 25 };
      case "twitter":
      case "x":
        return { searchTerms: keywords, tweetsDesired: 25 };
      default:
        return { searchQueries: keywords, resultsLimit: 25 };
    }
  }

  private async runActor(actorId: string, input: Record<string, unknown>, platform: string): Promise<FetchedItem[]> {
    try {
      // 1. Start actor run
      const startRes = await fetch(`${APIFY_BASE_URL}/acts/${actorId}/runs?token=${this.apiToken}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(30_000),
      });

      if (!startRes.ok) {
        logError("Apify: failed to start actor", { actorId, status: startRes.status });
        return [];
      }

      const startData = (await startRes.json()) as { data?: { id: string } };
      const runId = startData?.data?.id;
      if (!runId) {
        logError("Apify: no runId returned", { actorId });
        return [];
      }

      // 2. Poll until complete
      const datasetId = await this.pollForCompletion(runId);
      if (!datasetId) return [];

      // 3. Fetch dataset items
      const itemsRes = await fetch(
        `${APIFY_BASE_URL}/datasets/${datasetId}/items?token=${this.apiToken}&limit=100`,
        { signal: AbortSignal.timeout(30_000) },
      );
      if (!itemsRes.ok) {
        logError("Apify: failed to fetch dataset", { datasetId, status: itemsRes.status });
        return [];
      }

      const rawItems = (await itemsRes.json()) as Record<string, unknown>[];
      return this.mapToFetchedItems(rawItems, platform);
    } catch (err) {
      logError("Apify: actor run failed", { actorId, platform, error: String(err) });
      return [];
    }
  }

  private async pollForCompletion(runId: string): Promise<string | null> {
    const start = Date.now();

    while (Date.now() - start < POLL_TIMEOUT_MS) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

      try {
        const res = await fetch(
          `${APIFY_BASE_URL}/actor-runs/${runId}?token=${this.apiToken}`,
          { signal: AbortSignal.timeout(15_000) },
        );
        if (!res.ok) continue;

        const data = (await res.json()) as { data?: { status: string; defaultDatasetId?: string } };
        const status = data?.data?.status;

        if (status === "SUCCEEDED") {
          return data.data!.defaultDatasetId || null;
        }
        if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
          logError("Apify: run ended with status", { runId, status });
          return null;
        }
        // RUNNING or READY — continue polling
      } catch {
        // Transient fetch error — keep polling
      }
    }

    logWarn("Apify: polling timed out", { runId });
    return null;
  }

  private mapToFetchedItems(rawItems: Record<string, unknown>[], platform: string): FetchedItem[] {
    const items: FetchedItem[] = [];

    for (const raw of rawItems) {
      const id = String(raw.id || raw.postId || raw.tweetId || raw.shortcode || raw.url || "");
      if (!id) continue;

      const text = String(raw.text || raw.caption || raw.body || raw.postText || raw.fullText || "");
      if (!text) continue;

      items.push({
        platformPostId: `apify_${platform}_${id}`,
        platform,
        authorHandle: String(raw.username || raw.authorUsername || raw.handle || raw.author || "") || null,
        authorName: String(raw.authorName || raw.name || raw.displayName || "") || null,
        contentText: text,
        contentUrl: String(raw.url || raw.postUrl || raw.tweetUrl || raw.link || ""),
        language: String(raw.lang || raw.language || "") || null,
        publishedAt: raw.timestamp || raw.createdAt || raw.date
          ? new Date(String(raw.timestamp || raw.createdAt || raw.date))
          : null,
        metadata: {
          source: "apify",
          likes: raw.likes || raw.likesCount || raw.likeCount || 0,
          comments: raw.comments || raw.commentsCount || raw.replyCount || 0,
          shares: raw.shares || raw.sharesCount || raw.retweetCount || 0,
        },
      });
    }

    logInfo("Apify: mapped items", { platform, count: items.length });
    return items;
  }
}
