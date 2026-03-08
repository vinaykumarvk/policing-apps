import { logInfo, logError, logWarn } from "../logger";
import type { FetchedItem } from "./types";

const APIFY_BASE_URL = "https://api.apify.com/v2";
const POLL_INTERVAL_MS = 5_000;
const POLL_TIMEOUT_MS = 120_000;

/** Actor IDs by platform and mode */
const ACTOR_MAP: Record<string, { profile: string; keyword: string }> = {
  facebook: {
    profile: "apify/facebook-posts-scraper",
    keyword: "apify/facebook-search-scraper",
  },
  instagram: {
    profile: "apify/instagram-profile-scraper",
    keyword: "apify/instagram-hashtag-scraper",
  },
  twitter: {
    profile: "web.harvester/twitter-scraper",
    keyword: "apidojo/tweet-scraper",
  },
  x: {
    profile: "web.harvester/twitter-scraper",
    keyword: "apidojo/tweet-scraper",
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
      case "instagram": {
        // Instagram hashtag scraper requires single-word hashtags (no spaces/special chars)
        // Split multi-word keywords into individual hashtags and also create a joined variant
        const hashtags: string[] = [];
        for (const kw of keywords) {
          const words = kw.replace(/[^a-zA-Z0-9\u0900-\u0D7F\s]/g, "").split(/\s+/).filter(Boolean);
          hashtags.push(...words);
          if (words.length > 1) hashtags.push(words.join(""));  // e.g. "drugspunjab"
        }
        return { hashtags: [...new Set(hashtags)], resultsLimit: 25 };
      }
      case "twitter":
      case "x":
        return { searchTerms: keywords, tweetsDesired: 25 };
      default:
        return { searchQueries: keywords, resultsLimit: 25 };
    }
  }

  private async runActor(actorId: string, input: Record<string, unknown>, platform: string): Promise<FetchedItem[]> {
    try {
      // 1. Start actor run — Apify API uses ~ as namespace separator in URLs
      const actorPath = actorId.replace("/", "~");
      const startRes = await fetch(`${APIFY_BASE_URL}/acts/${actorPath}/runs?token=${this.apiToken}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(30_000),
      });

      if (!startRes.ok) {
        const errBody = await startRes.text().catch(() => "");
        logError("Apify: failed to start actor", { actorId, status: startRes.status, body: errBody.slice(0, 300) });
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
      // Skip error/empty sentinel items returned by some actors
      if (raw.noResults || raw.error) continue;

      const id = String(raw.id || raw.postId || raw.tweetId || raw.shortCode || raw.shortcode || raw.url || "");
      if (!id) continue;

      const text = String(raw.text || raw.caption || raw.body || raw.postText || raw.fullText || raw.message || "");
      if (!text) continue;

      items.push({
        platformPostId: `apify_${platform}_${id}`,
        platform,
        authorHandle: String(raw.ownerUsername || raw.username || raw.authorUsername || raw.handle || raw.author || "") || null,
        authorName: String(raw.ownerFullName || raw.authorName || raw.name || raw.displayName || "") || null,
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
