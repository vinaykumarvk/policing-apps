import { createSlaScheduler, logError } from "@puda/api-core";
import { query, getClient } from "./db";
import { executeTransition } from "./workflow-bridge";

const scheduler = createSlaScheduler({
  lockId: 900_001,
  queryFn: query,
  getClientFn: getClient,
  executeTransition,
});

export const startSlaScheduler = scheduler.start;
export const stopSlaScheduler = scheduler.stop;

// Scheduled report runner — checks for due reports and generates them
let reportInterval: ReturnType<typeof setInterval> | null = null;

async function runScheduledReports(): Promise<void> {
  try {
    const due = await query(
      `SELECT report_id, report_type, report_name, config_jsonb
       FROM scheduled_report
       WHERE is_active = TRUE AND (next_run_at IS NULL OR next_run_at <= NOW())
       LIMIT 10`,
    );
    for (const report of due.rows) {
      try {
        await query(
          `UPDATE scheduled_report SET last_run_at = NOW(), next_run_at = NOW() + INTERVAL '1 day', updated_at = NOW()
           WHERE report_id = $1`,
          [report.report_id],
        );
      } catch (err) {
        logError("SCHEDULED_REPORT_FAILED", { reportId: report.report_id, error: String(err) });
      }
    }
  } catch (err) {
    logError("SCHEDULED_REPORT_SCHEDULER_ERROR", { error: String(err) });
  }
}

export function startReportScheduler(): void {
  reportInterval = setInterval(runScheduledReports, 60_000 * 60); // hourly
  runScheduledReports().catch(() => {}); // initial run
}

export function stopReportScheduler(): void {
  if (reportInterval) {
    clearInterval(reportInterval);
    reportInterval = null;
  }
}

// ---------------------------------------------------------------------------
// FR-05 AC-01 — MR file scanner: checks for new unprocessed mandatory report files
// ---------------------------------------------------------------------------
let mrInterval: ReturnType<typeof setInterval> | null = null;

async function scanMrFiles(): Promise<void> {
  try {
    const unprocessed = await query(
      `SELECT file_id, file_name, file_path, uploaded_at
       FROM mr_upload
       WHERE processing_status = 'PENDING'
       ORDER BY uploaded_at ASC
       LIMIT 20`,
    );
    for (const file of unprocessed.rows) {
      try {
        await query(
          `UPDATE mr_upload SET processing_status = 'PROCESSING', started_at = NOW()
           WHERE file_id = $1 AND processing_status = 'PENDING'`,
          [file.file_id],
        );
        // Auto-detect: mark as DETECTED for downstream pipeline
        await query(
          `UPDATE mr_upload SET processing_status = 'DETECTED', updated_at = NOW()
           WHERE file_id = $1`,
          [file.file_id],
        );
      } catch (err) {
        logError("MR_SCANNER_FILE_FAILED", { fileId: file.file_id, error: String(err) });
        await query(
          `UPDATE mr_upload SET processing_status = 'FAILED', error_message = $1, updated_at = NOW()
           WHERE file_id = $2`,
          [String(err), file.file_id],
        ).catch(() => {});
      }
    }
  } catch (err) {
    logError("MR_SCANNER_ERROR", { error: String(err) });
  }
}

export function startMrScanner(): void {
  mrInterval = setInterval(scanMrFiles, 60_000 * 30); // every 30 min
  scanMrFiles().catch(() => {});
}

export function stopMrScanner(): void {
  if (mrInterval) {
    clearInterval(mrInterval);
    mrInterval = null;
  }
}
