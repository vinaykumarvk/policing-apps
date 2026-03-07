import { logError, logWarn } from "../logger";
import type { FetchedItem, PlatformConnector } from "./types";

const TWITTER_SEARCH_URL = "https://api.twitter.com/2/tweets/search/recent";

export class TwitterConnector implements PlatformConnector {
  readonly platform = "twitter";
  private bearerToken: string;

  constructor(bearerToken: string) {
    this.bearerToken = bearerToken;
  }

  async fetchByKeyword(keyword: string): Promise<FetchedItem[]> {
    const params = new URLSearchParams({
      query: `${keyword} -is:retweet`,
      max_results: "25",
      sort_order: "recency",
      "tweet.fields": "author_id,created_at,lang,public_metrics,source",
      expansions: "author_id",
      "user.fields": "username,name",
    });
    const url = `${TWITTER_SEARCH_URL}?${params}`;

    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${this.bearerToken}` },
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        logWarn("Twitter API non-OK response", { status: response.status, keyword });
        return [];
      }

      const json = (await response.json()) as TwitterSearchResponse;
      const items: FetchedItem[] = [];

      // Build author lookup from includes
      const authors = new Map<string, { username: string; name: string }>();
      for (const user of json?.includes?.users ?? []) {
        authors.set(user.id, { username: user.username, name: user.name });
      }

      for (const tweet of json?.data ?? []) {
        if (!tweet.id) continue;

        const author = authors.get(tweet.author_id ?? "");
        items.push({
          platformPostId: `twitter_${tweet.id}`,
          platform: "twitter",
          authorHandle: author?.username ? `@${author.username}` : null,
          authorName: author?.name ?? null,
          contentText: tweet.text,
          contentUrl: author?.username
            ? `https://twitter.com/${author.username}/status/${tweet.id}`
            : `https://twitter.com/i/status/${tweet.id}`,
          language: tweet.lang ?? null,
          publishedAt: tweet.created_at ? new Date(tweet.created_at) : null,
          metadata: {
            authorId: tweet.author_id,
            source: tweet.source,
            publicMetrics: tweet.public_metrics,
          },
        });
      }

      return items;
    } catch (err) {
      logError("Twitter fetch failed", { keyword, error: String(err) });
      return [];
    }
  }
}

// Minimal Twitter API v2 type definitions
interface TwitterSearchResponse {
  data: Array<{
    id: string;
    text: string;
    author_id?: string;
    created_at?: string;
    lang?: string;
    source?: string;
    public_metrics?: {
      retweet_count: number;
      reply_count: number;
      like_count: number;
      quote_count: number;
    };
  }>;
  includes?: {
    users?: Array<{
      id: string;
      username: string;
      name: string;
    }>;
  };
}
