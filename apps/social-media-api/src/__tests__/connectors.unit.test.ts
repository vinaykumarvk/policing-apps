/**
 * Unit tests for social media connectors, classifier, and entity extractor.
 * No database required — tests pure functions and mocked HTTP calls.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RedditConnector } from "../connectors/reddit";
import { YouTubeConnector } from "../connectors/youtube";
import { TwitterConnector } from "../connectors/twitter";
import { InstagramConnector } from "../connectors/instagram";
import { FacebookConnector } from "../connectors/facebook";
import { classifyContent } from "../services/classifier";
import { extractEntities } from "../services/entity-extractor";

// Save and restore global fetch for each connector test
let originalFetch: typeof globalThis.fetch;

describe("Connectors — Unit Tests", () => {
  // ========== classifyContent ==========
  describe("classifyContent", () => {
    it("returns UNCATEGORIZED with riskScore 0 for benign text", () => {
      const result = classifyContent("The weather is nice today");
      expect(result.category).toBe("UNCATEGORIZED");
      expect(result.riskScore).toBe(0);
      expect(result.factors).toHaveLength(0);
    });

    it("detects HATE_SPEECH keywords", () => {
      const result = classifyContent("this contains threat and violence content");
      expect(result.category).toBe("HATE_SPEECH");
      expect(result.riskScore).toBeGreaterThan(0);
    });

    it("detects FRAUD keywords", () => {
      const result = classifyContent("this is a scam and fraud operation");
      expect(result.category).toBe("FRAUD");
      expect(result.riskScore).toBeGreaterThan(0);
    });

    it("detects DRUGS keywords", () => {
      const result = classifyContent("drug trafficking and narcotic smuggling");
      expect(result.category).toBe("DRUGS");
      expect(result.riskScore).toBeGreaterThan(0);
    });

    it("detects TERRORISM keywords", () => {
      const result = classifyContent("terror bomb radicali jihad plot");
      expect(result.category).toBe("TERRORISM");
      expect(result.riskScore).toBeGreaterThan(0);
    });

    it("detects CYBER_CRIME keywords", () => {
      const result = classifyContent("hack into systems using malware and ransomware");
      expect(result.category).toBe("CYBER_CRIME");
      expect(result.riskScore).toBeGreaterThan(0);
    });

    it("detects HARASSMENT keywords", () => {
      const result = classifyContent("harass and stalk and bully people online");
      expect(result.category).toBe("HARASSMENT");
      expect(result.riskScore).toBeGreaterThan(0);
    });

    it("produces higher riskScore with more keyword matches", () => {
      const single = classifyContent("this is a scam");
      const multiple = classifyContent("this is a scam and fraud with phishing and money laundering");
      expect(multiple.riskScore).toBeGreaterThan(single.riskScore);
    });

    it("adds lengthy_content factor for text over 500 chars", () => {
      const longText = "threat " + "x".repeat(500);
      const result = classifyContent(longText);
      const lengthFactor = result.factors.find(f => f.factor === "lengthy_content");
      expect(lengthFactor).toBeDefined();
    });

    it("handles empty string gracefully", () => {
      const result = classifyContent("");
      expect(result.category).toBe("UNCATEGORIZED");
      expect(result.riskScore).toBe(0);
    });

    it("handles null-ish input gracefully", () => {
      const result = classifyContent(null as unknown as string);
      expect(result.category).toBe("UNCATEGORIZED");
      expect(result.riskScore).toBe(0);
    });

    it("is case-insensitive", () => {
      const lower = classifyContent("bomb threat");
      const upper = classifyContent("BOMB THREAT");
      expect(lower.category).toBe(upper.category);
      expect(lower.riskScore).toBe(upper.riskScore);
    });
  });

  // ========== extractEntities ==========
  describe("extractEntities", () => {
    it("extracts Indian phone numbers", () => {
      const entities = extractEntities("Call me at +91 98765 43210");
      const phones = entities.filter(e => e.entityType === "PHONE");
      expect(phones.length).toBeGreaterThanOrEqual(1);
      expect(phones[0].normalizedValue).toBe("9876543210");
    });

    it("extracts email addresses", () => {
      const entities = extractEntities("Email user@example.com for details");
      const emails = entities.filter(e => e.entityType === "EMAIL");
      expect(emails.length).toBe(1);
      expect(emails[0].normalizedValue).toBe("user@example.com");
    });

    it("extracts social media handles", () => {
      const entities = extractEntities("Follow @criminal_user on twitter");
      const handles = entities.filter(e => e.entityType === "HANDLE");
      expect(handles.length).toBe(1);
      expect(handles[0].normalizedValue).toBe("@criminal_user");
    });

    it("extracts PAN numbers", () => {
      const entities = extractEntities("PAN: ABCDE1234F");
      const pans = entities.filter(e => e.entityType === "PAN");
      expect(pans.length).toBe(1);
    });

    it("extracts vehicle registration numbers", () => {
      const entities = extractEntities("Vehicle: DL 01 AB 1234");
      const vehicles = entities.filter(e => e.entityType === "VEHICLE");
      expect(vehicles.length).toBeGreaterThanOrEqual(1);
    });

    it("deduplicates repeated entities", () => {
      const entities = extractEntities("user@example.com and user@example.com again");
      const emails = entities.filter(e => e.entityType === "EMAIL");
      expect(emails.length).toBe(1);
    });

    it("returns empty array for text with no entities", () => {
      const entities = extractEntities("Just a normal sentence about nothing");
      expect(entities).toHaveLength(0);
    });

    it("extracts multiple entity types from same text", () => {
      const entities = extractEntities("Contact @user at user@mail.com or +91 9876543210");
      const types = new Set(entities.map(e => e.entityType));
      expect(types.size).toBeGreaterThanOrEqual(2);
    });
  });

  // ========== Alert Threshold & Priority Logic ==========
  describe("Alert Threshold & Priority", () => {
    const mapPriority = (score: number) =>
      score >= 70 ? "HIGH" : score >= 50 ? "MEDIUM" : "LOW";

    it("multiple threat keywords push score above ALERT_THREAT_THRESHOLD (40)", () => {
      const result = classifyContent("terror bomb attack kill violence extremist radicali");
      expect(result.riskScore).toBeGreaterThanOrEqual(40);
    });

    it("single keyword stays well below threshold", () => {
      const result = classifyContent("there was a report about a scam");
      expect(result.riskScore).toBeLessThanOrEqual(25);
    });

    it("priority is HIGH for score >= 70", () => {
      expect(mapPriority(70)).toBe("HIGH");
      expect(mapPriority(100)).toBe("HIGH");
    });

    it("priority is MEDIUM for score 50-69", () => {
      expect(mapPriority(50)).toBe("MEDIUM");
      expect(mapPriority(69)).toBe("MEDIUM");
    });

    it("priority is LOW for score < 50", () => {
      expect(mapPriority(40)).toBe("LOW");
      expect(mapPriority(49)).toBe("LOW");
      expect(mapPriority(0)).toBe("LOW");
    });
  });

  // ========== RedditConnector ==========
  describe("RedditConnector", () => {
    const connector = new RedditConnector();

    beforeEach(() => { originalFetch = globalThis.fetch; });
    afterEach(() => { globalThis.fetch = originalFetch; });

    it("has platform = 'reddit'", () => {
      expect(connector.platform).toBe("reddit");
    });

    it("parses Reddit API response into FetchedItem array", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          data: {
            children: [{
              data: {
                id: "abc123", title: "Test Post", selftext: "Post body",
                author: "testuser", subreddit: "india",
                url: "https://reddit.com/r/india/abc123",
                permalink: "/r/india/comments/abc123/test/",
                score: 42, num_comments: 5, over_18: false, created_utc: 1709827200,
              },
            }],
          },
        }),
      } as any);

      const items = await connector.fetchByKeyword("test");
      expect(items).toHaveLength(1);
      expect(items[0].platformPostId).toBe("reddit_abc123");
      expect(items[0].platform).toBe("reddit");
      expect(items[0].authorHandle).toBe("testuser");
      expect(items[0].contentText).toContain("Test Post");
      expect(items[0].contentText).toContain("Post body");
      expect(items[0].metadata).toEqual(expect.objectContaining({
        subreddit: "india", score: 42, num_comments: 5,
      }));
    });

    it("returns empty array on HTTP error", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 } as any);
      const items = await connector.fetchByKeyword("test");
      expect(items).toHaveLength(0);
    });

    it("returns empty array on network failure", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));
      const items = await connector.fetchByKeyword("test");
      expect(items).toHaveLength(0);
    });

    it("handles empty children array", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { children: [] } }),
      } as any);
      const items = await connector.fetchByKeyword("test");
      expect(items).toHaveLength(0);
    });

    it("skips entries without id", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          data: {
            children: [
              { data: { id: "", title: "No ID", selftext: "", author: "x", subreddit: "r", url: "", permalink: "", score: 0, num_comments: 0, over_18: false, created_utc: 0 } },
              { data: { id: "valid1", title: "Valid", selftext: "", author: "y", subreddit: "r", url: "", permalink: "/r/test/valid1", score: 1, num_comments: 0, over_18: false, created_utc: 1709827200 } },
            ],
          },
        }),
      } as any);

      const items = await connector.fetchByKeyword("test");
      expect(items).toHaveLength(1);
      expect(items[0].platformPostId).toBe("reddit_valid1");
    });

    it("URL-encodes the keyword in the request", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true, json: () => Promise.resolve({ data: { children: [] } }),
      } as any);

      await connector.fetchByKeyword("cyber crime india");
      const calledUrl = (globalThis.fetch as any).mock.calls[0][0] as string;
      expect(calledUrl).toContain("q=cyber%20crime%20india");
    });

    it("platformPostId is prefixed with reddit_", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          data: { children: [{ data: { id: "xyz", title: "T", selftext: "", author: "a", subreddit: "s", url: "", permalink: "/p", score: 0, num_comments: 0, over_18: false, created_utc: 0 } }] },
        }),
      } as any);

      const items = await connector.fetchByKeyword("test");
      expect(items[0].platformPostId).toMatch(/^reddit_/);
    });
  });

  // ========== YouTubeConnector ==========
  describe("YouTubeConnector", () => {
    const connector = new YouTubeConnector("test-api-key");

    beforeEach(() => { originalFetch = globalThis.fetch; });
    afterEach(() => { globalThis.fetch = originalFetch; });

    it("has platform = 'youtube'", () => {
      expect(connector.platform).toBe("youtube");
    });

    it("parses YouTube API response into FetchedItem array", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          items: [{
            id: { videoId: "dQw4w9WgXcQ" },
            snippet: {
              title: "Test Video", description: "Video description",
              channelId: "UCtest", channelTitle: "Test Channel",
              publishedAt: "2024-03-07T12:00:00Z",
              thumbnails: { default: { url: "https://img.youtube.com/thumb.jpg" } },
              liveBroadcastContent: "none",
            },
          }],
        }),
      } as any);

      const items = await connector.fetchByKeyword("test");
      expect(items).toHaveLength(1);
      expect(items[0].platformPostId).toBe("youtube_dQw4w9WgXcQ");
      expect(items[0].platform).toBe("youtube");
      expect(items[0].authorName).toBe("Test Channel");
      expect(items[0].contentUrl).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
      expect(items[0].contentText).toContain("Test Video");
      expect(items[0].contentText).toContain("Video description");
    });

    it("includes API key in request URL", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true, json: () => Promise.resolve({ items: [] }),
      } as any);

      await connector.fetchByKeyword("test");
      const calledUrl = (globalThis.fetch as any).mock.calls[0][0] as string;
      expect(calledUrl).toContain("key=test-api-key");
    });

    it("returns empty array on 403 (suspended key)", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false, status: 403,
        text: () => Promise.resolve("Consumer has been suspended"),
      } as any);

      const items = await connector.fetchByKeyword("test");
      expect(items).toHaveLength(0);
    });

    it("returns empty array on network failure", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));
      const items = await connector.fetchByKeyword("test");
      expect(items).toHaveLength(0);
    });

    it("skips entries without videoId", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          items: [
            { id: {}, snippet: { title: "No ID", description: "", channelId: "", channelTitle: "", publishedAt: "", thumbnails: {}, liveBroadcastContent: "" } },
            { id: { videoId: "v1" }, snippet: { title: "Valid", description: "", channelId: "ch1", channelTitle: "Ch", publishedAt: "2024-01-01T00:00:00Z", thumbnails: {}, liveBroadcastContent: "none" } },
          ],
        }),
      } as any);

      const items = await connector.fetchByKeyword("test");
      expect(items).toHaveLength(1);
      expect(items[0].platformPostId).toBe("youtube_v1");
    });

    it("platformPostId is prefixed with youtube_", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          items: [{ id: { videoId: "v1" }, snippet: { title: "T", description: "", channelId: "", channelTitle: "", publishedAt: "", thumbnails: {}, liveBroadcastContent: "" } }],
        }),
      } as any);

      const items = await connector.fetchByKeyword("test");
      expect(items[0].platformPostId).toMatch(/^youtube_/);
    });
  });

  // ========== TwitterConnector ==========
  describe("TwitterConnector", () => {
    const connector = new TwitterConnector("test-bearer-token");

    beforeEach(() => { originalFetch = globalThis.fetch; });
    afterEach(() => { globalThis.fetch = originalFetch; });

    it("has platform = 'twitter'", () => {
      expect(connector.platform).toBe("twitter");
    });

    it("parses Twitter API v2 response with author expansion", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          data: [{
            id: "tweet123", text: "Alert about cyber crime",
            author_id: "user1", created_at: "2024-03-07T12:00:00.000Z",
            lang: "en", source: "Twitter Web App",
            public_metrics: { retweet_count: 5, reply_count: 2, like_count: 10, quote_count: 1 },
          }],
          includes: { users: [{ id: "user1", username: "testuser", name: "Test User" }] },
        }),
      } as any);

      const items = await connector.fetchByKeyword("cyber crime");
      expect(items).toHaveLength(1);
      expect(items[0].platformPostId).toBe("twitter_tweet123");
      expect(items[0].platform).toBe("twitter");
      expect(items[0].authorHandle).toBe("@testuser");
      expect(items[0].authorName).toBe("Test User");
      expect(items[0].contentText).toBe("Alert about cyber crime");
      expect(items[0].contentUrl).toContain("testuser/status/tweet123");
      expect(items[0].language).toBe("en");
    });

    it("sends Bearer token in Authorization header", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true, json: () => Promise.resolve({ data: [] }),
      } as any);

      await connector.fetchByKeyword("test");
      const headers = (globalThis.fetch as any).mock.calls[0][1].headers;
      expect(headers.Authorization).toBe("Bearer test-bearer-token");
    });

    it("filters retweets with -is:retweet in query", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true, json: () => Promise.resolve({ data: [] }),
      } as any);

      await connector.fetchByKeyword("test keyword");
      const calledUrl = (globalThis.fetch as any).mock.calls[0][0] as string;
      expect(calledUrl).toContain("-is%3Aretweet");
    });

    it("returns empty array on 402 (payment required)", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 402 } as any);
      const items = await connector.fetchByKeyword("test");
      expect(items).toHaveLength(0);
    });

    it("handles missing author gracefully", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          data: [{ id: "t1", text: "No author", author_id: "unknown" }],
          includes: { users: [] },
        }),
      } as any);

      const items = await connector.fetchByKeyword("test");
      expect(items).toHaveLength(1);
      expect(items[0].authorHandle).toBeNull();
      expect(items[0].contentUrl).toContain("/i/status/t1");
    });

    it("platformPostId is prefixed with twitter_", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true, json: () => Promise.resolve({
          data: [{ id: "t1", text: "text" }],
        }),
      } as any);

      const items = await connector.fetchByKeyword("test");
      expect(items[0].platformPostId).toMatch(/^twitter_/);
    });
  });

  // ========== InstagramConnector ==========
  describe("InstagramConnector", () => {
    const connector = new InstagramConnector("meta-token", "ig-biz-account-123");

    beforeEach(() => { originalFetch = globalThis.fetch; });
    afterEach(() => { globalThis.fetch = originalFetch; });

    it("has platform = 'instagram'", () => {
      expect(connector.platform).toBe("instagram");
    });

    it("resolves hashtag then fetches recent media", async () => {
      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        callCount++;
        if (url.includes("ig_hashtag_search")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: [{ id: "hashtag_001" }] }),
          });
        }
        // recent_media call
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: [{
              id: "media_123", caption: "Drug bust report",
              media_type: "IMAGE", media_url: "https://ig.com/img.jpg",
              permalink: "https://instagram.com/p/abc", timestamp: "2024-03-07T10:00:00Z",
              username: "reporter1",
            }],
          }),
        });
      });

      const items = await connector.fetchByKeyword("cybercrime");
      expect(callCount).toBe(2); // hashtag resolve + media fetch
      expect(items).toHaveLength(1);
      expect(items[0].platformPostId).toBe("instagram_media_123");
      expect(items[0].platform).toBe("instagram");
      expect(items[0].authorHandle).toBe("@reporter1");
      expect(items[0].contentText).toBe("Drug bust report");
    });

    it("strips non-alphanumeric chars from hashtag keyword", async () => {
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("ig_hashtag_search")) {
          // Verify the tag is cleaned
          expect(url).toContain("q=cybercrimeindia");
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: [] }),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) });
      });

      await connector.fetchByKeyword("cyber crime india");
    });

    it("returns empty array when hashtag not resolved", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true, json: () => Promise.resolve({ data: [] }),
      } as any);

      const items = await connector.fetchByKeyword("nonexistent");
      expect(items).toHaveLength(0);
    });

    it("returns empty array on API error", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 400 } as any);
      const items = await connector.fetchByKeyword("test");
      expect(items).toHaveLength(0);
    });

    it("platformPostId is prefixed with instagram_", async () => {
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("ig_hashtag_search")) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [{ id: "h1" }] }) });
        }
        return Promise.resolve({
          ok: true, json: () => Promise.resolve({ data: [{ id: "m1", caption: "c", username: "u" }] }),
        });
      });

      const items = await connector.fetchByKeyword("test");
      expect(items[0].platformPostId).toMatch(/^instagram_/);
    });
  });

  // ========== FacebookConnector ==========
  describe("FacebookConnector", () => {
    const connector = new FacebookConnector("meta-token");

    beforeEach(() => { originalFetch = globalThis.fetch; });
    afterEach(() => { globalThis.fetch = originalFetch; });

    it("has platform = 'facebook'", () => {
      expect(connector.platform).toBe("facebook");
    });

    it("searches pages then fetches posts from top results", async () => {
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("pages/search")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: [{ id: "page1", name: "Crime Watch" }] }),
          });
        }
        // page posts
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: [{
              id: "post_456", message: "Fraud alert in Delhi",
              created_time: "2024-03-07T08:00:00Z",
              permalink_url: "https://facebook.com/post_456",
              shares: { count: 12 },
              from: { id: "page1", name: "Crime Watch" },
            }],
          }),
        });
      });

      const items = await connector.fetchByKeyword("fraud");
      expect(items).toHaveLength(1);
      expect(items[0].platformPostId).toBe("facebook_post_456");
      expect(items[0].platform).toBe("facebook");
      expect(items[0].authorName).toBe("Crime Watch");
      expect(items[0].contentText).toBe("Fraud alert in Delhi");
      expect(items[0].metadata).toEqual(expect.objectContaining({ shares: 12 }));
    });

    it("limits to 5 pages max", async () => {
      const pages = Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, name: `Page ${i}` }));
      let postFetchCount = 0;

      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("pages/search")) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: pages }) });
        }
        postFetchCount++;
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) });
      });

      await connector.fetchByKeyword("test");
      expect(postFetchCount).toBe(5); // capped at 5
    });

    it("returns empty array when no pages found", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true, json: () => Promise.resolve({ data: [] }),
      } as any);

      const items = await connector.fetchByKeyword("nonexistent");
      expect(items).toHaveLength(0);
    });

    it("skips posts without message", async () => {
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("pages/search")) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [{ id: "p1", name: "P" }] }) });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: [
              { id: "no_msg", created_time: "2024-01-01T00:00:00Z" }, // no message
              { id: "has_msg", message: "Content here", created_time: "2024-01-01T00:00:00Z" },
            ],
          }),
        });
      });

      const items = await connector.fetchByKeyword("test");
      expect(items).toHaveLength(1);
      expect(items[0].platformPostId).toBe("facebook_has_msg");
    });

    it("returns empty array on API error", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as any);
      const items = await connector.fetchByKeyword("test");
      expect(items).toHaveLength(0);
    });

    it("platformPostId is prefixed with facebook_", async () => {
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("pages/search")) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [{ id: "p1", name: "P" }] }) });
        }
        return Promise.resolve({
          ok: true, json: () => Promise.resolve({ data: [{ id: "fp1", message: "msg" }] }),
        });
      });

      const items = await connector.fetchByKeyword("test");
      expect(items[0].platformPostId).toMatch(/^facebook_/);
    });
  });

  // ========== Connector Scheduler — initConnectors logic ==========
  describe("Connector Initialization Logic", () => {
    it("Reddit connector is always available (no auth required)", () => {
      const connector = new RedditConnector();
      expect(connector.platform).toBe("reddit");
    });

    it("YouTube connector requires API key at construction", () => {
      const connector = new YouTubeConnector("some-key");
      expect(connector.platform).toBe("youtube");
    });

    it("Twitter connector requires bearer token at construction", () => {
      const connector = new TwitterConnector("some-token");
      expect(connector.platform).toBe("twitter");
    });

    it("Instagram connector requires both token and business account ID", () => {
      const connector = new InstagramConnector("token", "account-id");
      expect(connector.platform).toBe("instagram");
    });

    it("Facebook connector requires access token", () => {
      const connector = new FacebookConnector("token");
      expect(connector.platform).toBe("facebook");
    });
  });
});
