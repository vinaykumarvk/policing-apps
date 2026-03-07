import { logError, logWarn } from "../logger";
import type { FetchedItem, PlatformConnector } from "./types";

const YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";

export class YouTubeConnector implements PlatformConnector {
  readonly platform = "youtube";
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async fetchByKeyword(keyword: string): Promise<FetchedItem[]> {
    const params = new URLSearchParams({
      part: "snippet",
      q: keyword,
      type: "video",
      order: "date",
      maxResults: "25",
      key: this.apiKey,
    });
    const url = `${YOUTUBE_SEARCH_URL}?${params}`;

    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        logWarn("YouTube API non-OK response", { status: response.status, keyword, body: body.slice(0, 500) });
        return [];
      }

      const json = (await response.json()) as YouTubeSearchResponse;
      const items: FetchedItem[] = [];

      for (const item of json?.items ?? []) {
        const videoId = item.id?.videoId;
        if (!videoId) continue;

        const s = item.snippet;
        const text = [s.title, s.description].filter(Boolean).join("\n\n");
        items.push({
          platformPostId: `youtube_${videoId}`,
          platform: "youtube",
          authorHandle: s.channelId ?? null,
          authorName: s.channelTitle ?? null,
          contentText: text,
          contentUrl: `https://www.youtube.com/watch?v=${videoId}`,
          language: null,
          publishedAt: s.publishedAt ? new Date(s.publishedAt) : null,
          metadata: {
            channelId: s.channelId,
            channelTitle: s.channelTitle,
            thumbnails: s.thumbnails,
            liveBroadcastContent: s.liveBroadcastContent,
          },
        });
      }

      return items;
    } catch (err) {
      logError("YouTube fetch failed", { keyword, error: String(err) });
      return [];
    }
  }
}

// Minimal YouTube Data API v3 type definitions
interface YouTubeSearchResponse {
  items: Array<{
    id: { videoId: string };
    snippet: {
      title: string;
      description: string;
      channelId: string;
      channelTitle: string;
      publishedAt: string;
      thumbnails: Record<string, unknown>;
      liveBroadcastContent: string;
    };
  }>;
}
