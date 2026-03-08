import { createHash } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { query } from "../db";
import { logInfo, logError } from "../logger";

// Lazy-loaded puppeteer-core — only imported when service is enabled
let puppeteer: typeof import("puppeteer-core") | null = null;

const SCREENSHOT_ENABLED = (process.env.SCREENSHOT_ENABLED ?? "true") !== "false";
const SCREENSHOT_TIMEOUT_MS = Number(process.env.SCREENSHOT_TIMEOUT_MS) || 30_000;
const CHROMIUM_PATH = process.env.CHROMIUM_PATH || "/usr/bin/chromium-browser";
const EVIDENCE_BASE_DIR = process.env.EVIDENCE_STORAGE_DIR || "/data/evidence";
const SCREENSHOTS_DIR = path.join(EVIDENCE_BASE_DIR, "screenshots");

type Browser = import("puppeteer-core").Browser;

let browser: Browser | null = null;

// ── Sequential Queue ──────────────────────────────────────────────────────

interface QueueItem {
  contentId: string;
  contentUrl: string;
  connectorId: string;
}

const queue: QueueItem[] = [];
let processing = false;

async function processQueue(): Promise<void> {
  if (processing) return;
  processing = true;

  while (queue.length > 0) {
    const item = queue.shift()!;
    try {
      await captureScreenshot(item.contentId, item.contentUrl, item.connectorId);
    } catch (err) {
      logError("Screenshot queue item failed", { contentId: item.contentId, error: String(err) });
    }
  }

  processing = false;
}

// ── Public API ────────────────────────────────────────────────────────────

export async function initScreenshotService(): Promise<void> {
  if (!SCREENSHOT_ENABLED) {
    logInfo("Screenshot service disabled via SCREENSHOT_ENABLED=false");
    return;
  }

  try {
    puppeteer = await import("puppeteer-core");
    await mkdir(SCREENSHOTS_DIR, { recursive: true });

    browser = await puppeteer.launch({
      executablePath: CHROMIUM_PATH,
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--single-process",
        "--no-zygote",
        "--disable-gpu",
      ],
    });

    logInfo("Screenshot service initialized", { chromiumPath: CHROMIUM_PATH });
  } catch (err) {
    logError("Failed to initialize screenshot service", { error: String(err) });
    browser = null;
  }
}

export async function shutdownScreenshotService(): Promise<void> {
  if (browser) {
    try {
      await browser.close();
      logInfo("Screenshot service shut down");
    } catch (err) {
      logError("Error closing screenshot browser", { error: String(err) });
    }
    browser = null;
  }
}

export function isScreenshotServiceReady(): boolean {
  return SCREENSHOT_ENABLED && browser !== null;
}

export function enqueueScreenshot(contentId: string, contentUrl: string, connectorId: string): void {
  if (!isScreenshotServiceReady()) return;

  try {
    new URL(contentUrl);
  } catch {
    return; // invalid URL — skip silently
  }

  queue.push({ contentId, contentUrl, connectorId });
  void processQueue();
}

// ── Internal ──────────────────────────────────────────────────────────────

async function captureScreenshot(
  contentId: string,
  contentUrl: string,
  connectorId: string,
): Promise<void> {
  if (!browser) return;

  let page: import("puppeteer-core").Page | null = null;
  try {
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    await page.goto(contentUrl, {
      waitUntil: "networkidle2",
      timeout: SCREENSHOT_TIMEOUT_MS,
    });

    const screenshotBuffer = await page.screenshot({ type: "png", fullPage: true }) as Buffer;

    // Compute SHA-256 hash
    const hashSha256 = createHash("sha256").update(screenshotBuffer).digest("hex");

    // Write to disk
    const filename = `${contentId}_${Date.now()}.png`;
    const filePath = path.join(SCREENSHOTS_DIR, filename);
    await writeFile(filePath, screenshotBuffer);

    // Generate evidence_ref
    const refResult = await query(
      `SELECT 'TEF-EVD-' || EXTRACT(YEAR FROM NOW())::text || '-' || LPAD(nextval('sm_evidence_ref_seq')::text, 6, '0') AS ref`,
    );
    const evidenceRef = refResult.rows[0].ref;

    // Insert evidence_item
    const evidenceResult = await query(
      `INSERT INTO evidence_item
         (content_id, capture_type, screenshot_url, hash_sha256, state_id, evidence_ref)
       VALUES ($1, 'AUTO_SCREENSHOT', $2, $3, 'CAPTURED', $4)
       RETURNING evidence_id`,
      [contentId, filePath, hashSha256, evidenceRef],
    );
    const evidenceId = evidenceResult.rows[0].evidence_id;

    // Log custody event
    await query(
      `INSERT INTO custody_event (evidence_id, event_type, actor_id, details)
       VALUES ($1, 'AUTO_CAPTURED', NULL, $2)`,
      [evidenceId, JSON.stringify({ connectorId, contentUrl, hashSha256, filename })],
    );

    logInfo("Auto-screenshot captured", { contentId, evidenceId, filename, hashSha256 });
  } catch (err) {
    // Create a CAPTURE_FAILED evidence record for visibility
    try {
      const refResult = await query(
        `SELECT 'TEF-EVD-' || EXTRACT(YEAR FROM NOW())::text || '-' || LPAD(nextval('sm_evidence_ref_seq')::text, 6, '0') AS ref`,
      );
      const evidenceRef = refResult.rows[0].ref;

      await query(
        `INSERT INTO evidence_item
           (content_id, capture_type, state_id, evidence_ref)
         VALUES ($1, 'AUTO_SCREENSHOT', 'CAPTURE_FAILED', $2)`,
        [contentId, evidenceRef],
      );
    } catch (dbErr) {
      logError("Failed to record CAPTURE_FAILED evidence", { contentId, error: String(dbErr) });
    }

    logError("Screenshot capture failed", { contentId, contentUrl, error: String(err) });
  } finally {
    if (page) {
      try { await page.close(); } catch { /* ignore */ }
    }
  }
}

// Exported for testing
export { captureScreenshot as _captureScreenshot, processQueue as _processQueue, queue as _queue };
