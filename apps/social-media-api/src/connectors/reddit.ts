import { logError, logWarn } from "../logger";
import type { FetchedItem, PlatformConnector } from "./types";

const REDDIT_SEARCH_URL = "https://www.reddit.com/search.json";

export class RedditConnector implements PlatformConnector {
  readonly platform = "reddit";

  async fetchByKeyword(keyword: string): Promise<FetchedItem[]> {
    const url = `${REDDIT_SEARCH_URL}?q=${encodeURIComponent(keyword)}&sort=new&limit=25`;
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "PUDA-SocialMediaMonitor/1.0" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        logWarn("Reddit API non-OK response", { status: response.status, keyword });
        return [];
      }

      const json = (await response.json()) as RedditListing;
      const items: FetchedItem[] = [];

      for (const child of json?.data?.children ?? []) {
        const d = child.data;
        if (!d || !d.id) continue;

        const text = [d.title, d.selftext].filter(Boolean).join("\n\n");
        items.push({
          platformPostId: `reddit_${d.id}`,
          platform: "reddit",
          authorHandle: d.author ?? null,
          authorName: d.author ?? null,
          contentText: text,
          contentUrl: d.url || `https://www.reddit.com${d.permalink}`,
          language: null,
          publishedAt: d.created_utc ? new Date(d.created_utc * 1000) : null,
          metadata: {
            subreddit: d.subreddit,
            score: d.score,
            num_comments: d.num_comments,
            over_18: d.over_18,
            permalink: d.permalink,
          },
        });
      }

      return items;
    } catch (err) {
      logError("Reddit fetch failed", { keyword, error: String(err) });
      return [];
    }
  }
}

// Minimal Reddit API type definitions
interface RedditListing {
  data: {
    children: Array<{
      data: {
        id: string;
        title: string;
        selftext: string;
        author: string;
        subreddit: string;
        url: string;
        permalink: string;
        score: number;
        num_comments: number;
        over_18: boolean;
        created_utc: number;
      };
    }>;
  };
}
