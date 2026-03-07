export interface FetchedItem {
  platformPostId: string;
  platform: string;
  authorHandle: string | null;
  authorName: string | null;
  contentText: string;
  contentUrl: string;
  language: string | null;
  publishedAt: Date | null;
  metadata: Record<string, unknown>;
}

export interface PlatformConnector {
  platform: string;
  fetchByKeyword(keyword: string): Promise<FetchedItem[]>;
}
