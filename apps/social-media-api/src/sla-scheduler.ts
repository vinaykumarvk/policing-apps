import { createSlaScheduler } from "@puda/api-core";
import { query, getClient } from "./db";
import { executeTransition } from "./workflow-bridge";

const scheduler = createSlaScheduler({
  lockId: 900_003,
  queryFn: query,
  getClientFn: getClient,
  executeTransition,
});

export const startSlaScheduler = scheduler.start;
export const stopSlaScheduler = scheduler.stop;

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
        console.error(`[scheduled-report] Failed to process report ${report.report_id}:`, err);
      }
    }
  } catch (err) {
    console.error("[scheduled-report] Scheduler error:", err);
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
