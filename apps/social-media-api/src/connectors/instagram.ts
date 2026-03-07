import { logError, logWarn } from "../logger";
import type { FetchedItem, PlatformConnector } from "./types";

const GRAPH_API_BASE = "https://graph.facebook.com/v19.0";

/**
 * Instagram Graph API connector.
 * Uses hashtag search → recent media flow.
 * Requires a Meta access token and an Instagram Business Account ID.
 */
export class InstagramConnector implements PlatformConnector {
  readonly platform = "instagram";
  private accessToken: string;
  private igBusinessAccountId: string;

  constructor(accessToken: string, igBusinessAccountId: string) {
    this.accessToken = accessToken;
    this.igBusinessAccountId = igBusinessAccountId;
  }

  async fetchByKeyword(keyword: string): Promise<FetchedItem[]> {
    try {
      // Step 1: Resolve hashtag ID
      const hashtagId = await this.resolveHashtagId(keyword);
      if (!hashtagId) return [];

      // Step 2: Fetch recent media for the hashtag
      const params = new URLSearchParams({
        user_id: this.igBusinessAccountId,
        fields: "id,caption,media_type,media_url,permalink,timestamp,username",
        limit: "25",
        access_token: this.accessToken,
      });
      const url = `${GRAPH_API_BASE}/${hashtagId}/recent_media?${params}`;

      const response = await fetch(url, {
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        logWarn("Instagram API non-OK response", { status: response.status, keyword });
        return [];
      }

      const json = (await response.json()) as InstagramMediaResponse;
      const items: FetchedItem[] = [];

      for (const media of json?.data ?? []) {
        if (!media.id) continue;

        items.push({
          platformPostId: `instagram_${media.id}`,
          platform: "instagram",
          authorHandle: media.username ? `@${media.username}` : null,
          authorName: media.username ?? null,
          contentText: media.caption || "",
          contentUrl: media.permalink || "",
          language: null,
          publishedAt: media.timestamp ? new Date(media.timestamp) : null,
          metadata: {
            mediaType: media.media_type,
            mediaUrl: media.media_url,
          },
        });
      }

      return items;
    } catch (err) {
      logError("Instagram fetch failed", { keyword, error: String(err) });
      return [];
    }
  }

  private async resolveHashtagId(keyword: string): Promise<string | null> {
    // Strip spaces/special chars — Instagram hashtags are single tokens
    const tag = keyword.replace(/[^a-zA-Z0-9_\u0900-\u097F]/g, "").toLowerCase();
    if (!tag) return null;

    const params = new URLSearchParams({
      q: tag,
      user_id: this.igBusinessAccountId,
      access_token: this.accessToken,
    });
    const url = `${GRAPH_API_BASE}/ig_hashtag_search?${params}`;

    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        logWarn("Instagram hashtag search non-OK", { status: response.status, tag });
        return null;
      }
      const json = (await response.json()) as { data?: Array<{ id: string }> };
      return json?.data?.[0]?.id ?? null;
    } catch (err) {
      logError("Instagram hashtag resolution failed", { tag, error: String(err) });
      return null;
    }
  }
}

interface InstagramMediaResponse {
  data: Array<{
    id: string;
    caption?: string;
    media_type?: string;
    media_url?: string;
    permalink?: string;
    timestamp?: string;
    username?: string;
  }>;
}
