/**
 * Capture screenshots for high-threat posts using local Chrome.
 *
 * Usage:
 *   npx tsx apps/social-media-api/scripts/capture-screenshots.ts [limit]
 *
 * Requires: puppeteer-core + Chrome/Chromium installed locally.
 * Set CHROMIUM_PATH env to override the default Chrome path.
 */
import { createHash } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { query, pool } from "../src/db";

const LIMIT = Number(process.argv[2]) || 5;
const EVIDENCE_DIR = process.env.EVIDENCE_STORAGE_DIR || path.resolve(__dirname, "..", "evidence-local");
const SCREENSHOTS_DIR = path.join(EVIDENCE_DIR, "screenshots");
const SCREENSHOT_TIMEOUT_MS = Number(process.env.SCREENSHOT_TIMEOUT_MS) || 30_000;

// Find Chrome on macOS / Linux
const CHROMIUM_PATH =
  process.env.CHROMIUM_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

function log(msg: string) {
  console.log(`[SCREENSHOT] ${msg}`);
}

async function main() {
  log(`Chrome path: ${CHROMIUM_PATH}`);
  log(`Output dir:  ${SCREENSHOTS_DIR}`);
  log(`Limit:       ${LIMIT} posts`);
  log("");

  await mkdir(SCREENSHOTS_DIR, { recursive: true });

  // Import puppeteer-core
  const puppeteer = await import("puppeteer-core");

  // Find posts that need screenshots (high threat, have URL, no existing evidence)
  const postsResult = await query(
    `SELECT c.content_id, c.platform, c.content_url, c.threat_score,
            LEFT(c.content_text, 80) AS preview
     FROM content_item c
     LEFT JOIN evidence_item e ON e.content_id = c.content_id
     WHERE c.content_url IS NOT NULL
       AND c.content_url != ''
       AND c.threat_score >= 15
       AND e.evidence_id IS NULL
     ORDER BY c.threat_score DESC
     LIMIT $1`,
    [LIMIT],
  );

  if (postsResult.rows.length === 0) {
    log("No posts need screenshots (all already captured or none qualify).");
    return;
  }

  log(`Found ${postsResult.rows.length} posts to screenshot\n`);

  // Launch browser
  const browser = await puppeteer.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });

  let captured = 0;
  let failed = 0;

  for (const post of postsResult.rows) {
    const { content_id, platform, content_url, threat_score, preview } = post;
    log(`Capturing [${platform}] score=${threat_score}: ${content_url}`);

    let page: import("puppeteer-core").Page | null = null;
    try {
      page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 900 });

      await page.goto(content_url, {
        waitUntil: "networkidle2",
        timeout: SCREENSHOT_TIMEOUT_MS,
      });

      // Wait a moment for lazy-loaded content
      await new Promise((r) => setTimeout(r, 2000));

      const screenshotBuffer = (await page.screenshot({
        type: "png",
        fullPage: true,
      })) as Buffer;

      // Compute SHA-256
      const hashSha256 = createHash("sha256").update(screenshotBuffer).digest("hex");

      // Save to disk
      const filename = `${content_id}_${Date.now()}.png`;
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
        [content_id, filePath, hashSha256, evidenceRef],
      );
      const evidenceId = evidenceResult.rows[0].evidence_id;

      // Log custody event
      await query(
        `INSERT INTO custody_event (evidence_id, event_type, actor_id, details)
         VALUES ($1, 'AUTO_CAPTURED', NULL, $2)`,
        [evidenceId, JSON.stringify({ content_url, hashSha256, filename, capturedLocally: true })],
      );

      log(`  OK  ${evidenceRef} → ${filename} (${(screenshotBuffer.length / 1024).toFixed(0)} KB, SHA256: ${hashSha256.slice(0, 16)}...)`);
      captured++;
    } catch (err) {
      log(`  FAIL ${content_url}: ${err}`);
      // Record failure in DB
      try {
        const refResult = await query(
          `SELECT 'TEF-EVD-' || EXTRACT(YEAR FROM NOW())::text || '-' || LPAD(nextval('sm_evidence_ref_seq')::text, 6, '0') AS ref`,
        );
        await query(
          `INSERT INTO evidence_item (content_id, capture_type, state_id, evidence_ref)
           VALUES ($1, 'AUTO_SCREENSHOT', 'CAPTURE_FAILED', $2)`,
          [content_id, refResult.rows[0].ref],
        );
      } catch {
        // ignore DB error on failure recording
      }
      failed++;
    } finally {
      if (page) {
        try { await page.close(); } catch { /* ignore */ }
      }
    }
  }

  await browser.close();

  log(`\n════════════════════════════════════════`);
  log(`SCREENSHOT SUMMARY`);
  log(`  Captured: ${captured}`);
  log(`  Failed:   ${failed}`);
  log(`════════════════════════════════════════`);

  // Show evidence table
  const evidence = await query(
    `SELECT e.evidence_ref, e.state_id, e.capture_type, e.hash_sha256,
            c.platform, c.threat_score
     FROM evidence_item e
     JOIN content_item c ON c.content_id = e.content_id
     ORDER BY e.created_at DESC LIMIT 10`,
  );
  console.log("\n── Recent Evidence Items ──");
  console.table(evidence.rows);
}

main()
  .catch((err) => {
    console.error("[SCREENSHOT] Fatal error:", err);
    process.exit(1);
  })
  .finally(() => pool.end());
