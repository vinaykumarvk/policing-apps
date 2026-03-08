import { createSlaScheduler } from "@puda/api-core";
import { query, getClient } from "./db";
import { executeTransition } from "./workflow-bridge";
import { forwardToSiem, startSiemForwarder, stopSiemForwarder } from "./services/siem-forwarder";

const scheduler = createSlaScheduler({
  lockId: 900_003,
  queryFn: query,
  getClientFn: getClient,
  executeTransition,
});

const _origStart = scheduler.start;
const _origStop = scheduler.stop;

export function startSlaScheduler(): void {
  _origStart();
  startSiemForwarder();
  startHighSeverityAlertForwarder();
}

export function stopSlaScheduler(): void {
  _origStop();
  stopSiemForwarder();
  stopHighSeverityAlertForwarder();
}

// FR-15 AC-05: Periodically forward high-severity alerts to SIEM
let siemAlertInterval: ReturnType<typeof setInterval> | null = null;

async function forwardHighSeverityAlerts(): Promise<void> {
  try {
    const result = await query(
      `SELECT alert_id, alert_ref, alert_type, priority, title, state_id, created_at
       FROM sm_alert
       WHERE priority IN ('CRITICAL', 'HIGH')
         AND state_id NOT IN ('DISMISSED', 'FALSE_POSITIVE', 'CLOSED')
         AND siem_forwarded_at IS NULL
       ORDER BY created_at ASC
       LIMIT 50`,
    );

    for (const alert of result.rows) {
      forwardToSiem({
        event_type: "HIGH_SEVERITY_ALERT",
        entity_type: "sm_alert",
        entity_id: alert.alert_id,
        alert_ref: alert.alert_ref,
        alert_type: alert.alert_type,
        priority: alert.priority,
        state_id: alert.state_id,
        title: alert.title,
        created_at: alert.created_at,
      });

      await query(
        `UPDATE sm_alert SET siem_forwarded_at = NOW() WHERE alert_id = $1`,
        [alert.alert_id],
      );
    }
  } catch (err) {
    console.error("[siem-alert-forwarder] Error:", err);
  }
}

function startHighSeverityAlertForwarder(): void {
  siemAlertInterval = setInterval(forwardHighSeverityAlerts, 60_000);
  forwardHighSeverityAlerts().catch(() => {});
}

function stopHighSeverityAlertForwarder(): void {
  if (siemAlertInterval) {
    clearInterval(siemAlertInterval);
    siemAlertInterval = null;
  }
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
