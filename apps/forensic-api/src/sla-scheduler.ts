import { createSlaScheduler, logError } from "@puda/api-core";
import { query, getClient } from "./db";
import { executeTransition } from "./workflow-bridge";

const scheduler = createSlaScheduler({
  lockId: 900_002,
  queryFn: query,
  getClientFn: getClient,
  executeTransition,
});

const _origStart = scheduler.start;
const _origStop = scheduler.stop;

export function startSlaScheduler(): void {
  _origStart();
  startReportScheduler();
}

export function stopSlaScheduler(): void {
  _origStop();
  stopReportScheduler();
}

// Scheduled report runner
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
  reportInterval = setInterval(runScheduledReports, 60_000 * 60);
  runScheduledReports().catch(() => {});
}

export function stopReportScheduler(): void {
  if (reportInterval) {
    clearInterval(reportInterval);
    reportInterval = null;
  }
}
