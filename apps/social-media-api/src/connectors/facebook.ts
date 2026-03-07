import { logError, logWarn } from "../logger";
import type { FetchedItem, PlatformConnector } from "./types";

const GRAPH_API_BASE = "https://graph.facebook.com/v19.0";

/**
 * Facebook Graph API connector.
 * Searches public page posts via the Pages Search API.
 * Requires a Meta access token with `pages_read_engagement` permission.
 */
export class FacebookConnector implements PlatformConnector {
  readonly platform = "facebook";
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  async fetchByKeyword(keyword: string): Promise<FetchedItem[]> {
    try {
      // Step 1: Search for public pages matching the keyword
      const pages = await this.searchPages(keyword);
      if (pages.length === 0) return [];

      const items: FetchedItem[] = [];

      // Step 2: Fetch recent posts from top matching pages (limit to 5 pages)
      for (const page of pages.slice(0, 5)) {
        const posts = await this.getPagePosts(page.id, page.name);
        items.push(...posts);
      }

      return items;
    } catch (err) {
      logError("Facebook fetch failed", { keyword, error: String(err) });
      return [];
    }
  }

  private async searchPages(keyword: string): Promise<Array<{ id: string; name: string }>> {
    const params = new URLSearchParams({
      q: keyword,
      type: "page",
      fields: "id,name",
      limit: "5",
      access_token: this.accessToken,
    });
    const url = `${GRAPH_API_BASE}/pages/search?${params}`;

    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        logWarn("Facebook page search non-OK", { status: response.status, keyword });
        return [];
      }
      const json = (await response.json()) as { data?: Array<{ id: string; name: string }> };
      return json?.data ?? [];
    } catch (err) {
      logError("Facebook page search failed", { keyword, error: String(err) });
      return [];
    }
  }

  private async getPagePosts(pageId: string, pageName: string): Promise<FetchedItem[]> {
    const params = new URLSearchParams({
      fields: "id,message,created_time,permalink_url,shares,from",
      limit: "10",
      access_token: this.accessToken,
    });
    const url = `${GRAPH_API_BASE}/${pageId}/posts?${params}`;

    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        logWarn("Facebook page posts non-OK", { status: response.status, pageId });
        return [];
      }

      const json = (await response.json()) as FacebookPostsResponse;
      const items: FetchedItem[] = [];

      for (const post of json?.data ?? []) {
        if (!post.id || !post.message) continue;

        items.push({
          platformPostId: `facebook_${post.id}`,
          platform: "facebook",
          authorHandle: pageName,
          authorName: post.from?.name ?? pageName,
          contentText: post.message,
          contentUrl: post.permalink_url || `https://www.facebook.com/${post.id}`,
          language: null,
          publishedAt: post.created_time ? new Date(post.created_time) : null,
          metadata: {
            pageId,
            pageName,
            shares: post.shares?.count ?? 0,
            fromId: post.from?.id,
          },
        });
      }

      return items;
    } catch (err) {
      logError("Facebook page posts fetch failed", { pageId, error: String(err) });
      return [];
    }
  }
}

interface FacebookPostsResponse {
  data: Array<{
    id: string;
    message?: string;
    created_time?: string;
    permalink_url?: string;
    shares?: { count: number };
    from?: { id: string; name: string };
  }>;
}
