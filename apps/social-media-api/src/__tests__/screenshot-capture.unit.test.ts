/**
 * Unit tests for auto-screenshot capture service.
 * Mocks puppeteer-core, fs, and database to test capture logic in isolation.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────

const mockScreenshot = vi.fn().mockResolvedValue(Buffer.from("fake-png"));
const mockGoto = vi.fn().mockResolvedValue(undefined);
const mockSetViewport = vi.fn().mockResolvedValue(undefined);
const mockPageClose = vi.fn().mockResolvedValue(undefined);
const mockNewPage = vi.fn().mockResolvedValue({
  screenshot: mockScreenshot,
  goto: mockGoto,
  setViewport: mockSetViewport,
  close: mockPageClose,
});
const mockBrowserClose = vi.fn().mockResolvedValue(undefined);
const mockLaunch = vi.fn().mockResolvedValue({
  newPage: mockNewPage,
  close: mockBrowserClose,
});

vi.mock("puppeteer-core", () => ({
  default: { launch: (...args: unknown[]) => mockLaunch(...args) },
  launch: (...args: unknown[]) => mockLaunch(...args),
}));

const mockQuery = vi.fn();
vi.mock("../db", () => ({
  query: (...args: unknown[]) => mockQuery(...args),
}));

vi.mock("../logger", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

const mockWriteFile = vi.fn().mockResolvedValue(undefined);
const mockMkdir = vi.fn().mockResolvedValue(undefined);
vi.mock("node:fs/promises", () => ({
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
  mkdir: (...args: unknown[]) => mockMkdir(...args),
}));

// ── Import after mocks ───────────────────────────────────────────────────

// Reset module state between tests by re-importing
let mod: typeof import("../services/screenshot-capture");

beforeEach(async () => {
  vi.clearAllMocks();

  // Reset environment
  process.env.SCREENSHOT_ENABLED = "true";
  process.env.CHROMIUM_PATH = "/usr/bin/chromium-browser";

  // Default DB responses
  mockQuery.mockImplementation((sql: string) => {
    if (sql.includes("sm_evidence_ref_seq")) {
      return Promise.resolve({ rows: [{ ref: "TEF-EVD-2026-000001" }] });
    }
    if (sql.includes("INSERT INTO evidence_item")) {
      return Promise.resolve({ rows: [{ evidence_id: "eid-001" }] });
    }
    if (sql.includes("INSERT INTO custody_event")) {
      return Promise.resolve({ rows: [] });
    }
    return Promise.resolve({ rows: [] });
  });

  // Re-import module fresh — need dynamic import with cache bust
  vi.resetModules();
  mod = await import("../services/screenshot-capture");
});

afterEach(async () => {
  try {
    await mod.shutdownScreenshotService();
  } catch { /* ignore */ }
});

describe("screenshot-capture service", () => {
  describe("initScreenshotService", () => {
    it("launches Chromium with correct flags when enabled", async () => {
      await mod.initScreenshotService();

      expect(mockLaunch).toHaveBeenCalledOnce();
      const launchArgs = mockLaunch.mock.calls[0][0];
      expect(launchArgs.executablePath).toBe("/usr/bin/chromium-browser");
      expect(launchArgs.headless).toBe(true);
      expect(launchArgs.args).toContain("--no-sandbox");
      expect(launchArgs.args).toContain("--disable-dev-shm-usage");
      expect(launchArgs.args).toContain("--single-process");
      expect(launchArgs.args).toContain("--no-zygote");
      expect(launchArgs.args).toContain("--disable-gpu");
    });

    it("creates screenshots directory", async () => {
      await mod.initScreenshotService();

      expect(mockMkdir).toHaveBeenCalledWith(
        expect.stringContaining("screenshots"),
        { recursive: true },
      );
    });

    it("is a no-op when SCREENSHOT_ENABLED=false", async () => {
      process.env.SCREENSHOT_ENABLED = "false";
      vi.resetModules();
      mod = await import("../services/screenshot-capture");

      await mod.initScreenshotService();

      expect(mockLaunch).not.toHaveBeenCalled();
      expect(mod.isScreenshotServiceReady()).toBe(false);
    });

    it("handles launch failure gracefully", async () => {
      mockLaunch.mockRejectedValueOnce(new Error("Chromium not found"));

      await mod.initScreenshotService();

      expect(mod.isScreenshotServiceReady()).toBe(false);
    });
  });

  describe("isScreenshotServiceReady", () => {
    it("returns true after successful init", async () => {
      await mod.initScreenshotService();
      expect(mod.isScreenshotServiceReady()).toBe(true);
    });

    it("returns false before init", () => {
      expect(mod.isScreenshotServiceReady()).toBe(false);
    });
  });

  describe("enqueueScreenshot", () => {
    it("skips invalid URLs silently", async () => {
      await mod.initScreenshotService();

      mod.enqueueScreenshot("cid-001", "not-a-url", "conn-001");

      // No error, no page opened
      // Give queue time to process
      await new Promise((r) => setTimeout(r, 50));
      expect(mockNewPage).not.toHaveBeenCalled();
    });

    it("skips when service is not ready", () => {
      // Don't init — browser is null
      mod.enqueueScreenshot("cid-001", "https://example.com/post", "conn-001");

      // Nothing queued — no page opened
      expect(mockNewPage).not.toHaveBeenCalled();
    });

    it("happy path: navigates, screenshots, writes file, inserts evidence + custody", async () => {
      await mod.initScreenshotService();

      mod.enqueueScreenshot("cid-001", "https://example.com/post/123", "conn-001");

      // Wait for queue to process
      await new Promise((r) => setTimeout(r, 100));

      // Navigation
      expect(mockGoto).toHaveBeenCalledWith(
        "https://example.com/post/123",
        expect.objectContaining({ waitUntil: "networkidle2" }),
      );

      // Screenshot taken
      expect(mockScreenshot).toHaveBeenCalledWith({ type: "png", fullPage: true });

      // File written
      expect(mockWriteFile).toHaveBeenCalledOnce();
      const writtenPath = mockWriteFile.mock.calls[0][0] as string;
      expect(writtenPath).toContain("cid-001");
      expect(writtenPath).toMatch(/\.png$/);

      // Evidence item inserted with state=CAPTURED
      const evidenceInsertCall = mockQuery.mock.calls.find(
        (c: string[]) => c[0].includes("INSERT INTO evidence_item") && c[0].includes("AUTO_SCREENSHOT"),
      );
      expect(evidenceInsertCall).toBeDefined();
      expect(evidenceInsertCall![1]).toContain("cid-001"); // contentId
      expect(evidenceInsertCall![0]).toContain("CAPTURED"); // state_id is a SQL literal

      // Custody event logged
      const custodyCall = mockQuery.mock.calls.find(
        (c: string[]) => c[0].includes("INSERT INTO custody_event") && c[0].includes("AUTO_CAPTURED"),
      );
      expect(custodyCall).toBeDefined();

      // Page closed
      expect(mockPageClose).toHaveBeenCalled();
    });

    it("creates CAPTURE_FAILED evidence on navigation timeout", async () => {
      await mod.initScreenshotService();

      mockGoto.mockRejectedValueOnce(new Error("Navigation timeout"));

      mod.enqueueScreenshot("cid-002", "https://example.com/timeout", "conn-001");

      await new Promise((r) => setTimeout(r, 100));

      // Should have inserted a CAPTURE_FAILED evidence
      const failedInsertCall = mockQuery.mock.calls.find(
        (c: string[]) => c[0].includes("CAPTURE_FAILED"),
      );
      expect(failedInsertCall).toBeDefined();
      expect(failedInsertCall![1]).toContain("cid-002");

      // Page still closed in finally
      expect(mockPageClose).toHaveBeenCalled();
    });

    it("processes items sequentially (FIFO)", async () => {
      await mod.initScreenshotService();

      const captureOrder: string[] = [];
      mockGoto.mockImplementation(async (url: string) => {
        captureOrder.push(url);
        // Small delay to simulate real navigation
        await new Promise((r) => setTimeout(r, 20));
      });

      mod.enqueueScreenshot("cid-a", "https://example.com/a", "conn-001");
      mod.enqueueScreenshot("cid-b", "https://example.com/b", "conn-001");
      mod.enqueueScreenshot("cid-c", "https://example.com/c", "conn-001");

      // Wait for all to process
      await new Promise((r) => setTimeout(r, 300));

      expect(captureOrder).toEqual([
        "https://example.com/a",
        "https://example.com/b",
        "https://example.com/c",
      ]);
    });
  });

  describe("shutdownScreenshotService", () => {
    it("closes the browser", async () => {
      await mod.initScreenshotService();
      await mod.shutdownScreenshotService();

      expect(mockBrowserClose).toHaveBeenCalledOnce();
      expect(mod.isScreenshotServiceReady()).toBe(false);
    });

    it("is safe to call when browser was never started", async () => {
      // No init — should not throw
      await mod.shutdownScreenshotService();
      expect(mockBrowserClose).not.toHaveBeenCalled();
    });
  });
});
