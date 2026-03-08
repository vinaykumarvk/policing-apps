import { query } from "../db";
import { logInfo, logError } from "@puda/api-core";

export interface SiemConfig {
  enabled: boolean;
  endpoint: string;
  transport: "webhook" | "syslog";
  format: "json" | "cef";
  batchSize: number;
  flushIntervalMs: number;
}

function getConfig(): SiemConfig {
  return {
    enabled: process.env.SIEM_ENABLED === "true",
    endpoint: process.env.SIEM_ENDPOINT || "",
    transport: (process.env.SIEM_TRANSPORT as "webhook" | "syslog") || "webhook",
    format: (process.env.SIEM_FORMAT as "json" | "cef") || "json",
    batchSize: parseInt(process.env.SIEM_BATCH_SIZE || "50", 10),
    flushIntervalMs: parseInt(process.env.SIEM_FLUSH_INTERVAL_MS || "30000", 10),
  };
}

const eventBuffer: Array<Record<string, unknown>> = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;

function formatCef(event: Record<string, unknown>): string {
  const severity = event.event_type === "AUTH_FAILURE" ? 8 : 3;
  return `CEF:0|TEF|SocialMediaAPI|1.0|${event.event_type}|${event.entity_type || "system"}|${severity}|src=${event.actor_id || "system"} dst=${event.entity_id || "N/A"} msg=${event.remarks || ""}`;
}

async function flushEvents(): Promise<void> {
  const config = getConfig();
  if (!config.enabled || eventBuffer.length === 0) return;

  const batch = eventBuffer.splice(0, config.batchSize);
  try {
    if (config.transport === "webhook" && config.endpoint) {
      const payload = config.format === "cef"
        ? batch.map(formatCef).join("\n")
        : JSON.stringify(batch);

      // In production, use fetch() to POST to SIEM endpoint
      // Stub: log the forwarding action
      logInfo("SIEM_FORWARD", { count: batch.length, endpoint: config.endpoint });

      // Record forwarding in audit
      await query(
        `INSERT INTO audit_log (entity_type, entity_id, event_type, actor_id, payload_jsonb)
         VALUES ('SIEM', 'BATCH', 'SIEM_FORWARD', 'SYSTEM', $1)`,
        [JSON.stringify({ count: batch.length, endpoint: config.endpoint })],
      );
    }
  } catch (err) {
    // Re-queue failed events
    eventBuffer.unshift(...batch);
    logError("SIEM_FLUSH_FAILED", { error: String(err), batchSize: batch.length });
  }
}

export function forwardToSiem(event: Record<string, unknown>): void {
  const config = getConfig();
  if (!config.enabled) return;
  eventBuffer.push({ ...event, forwarded_at: new Date().toISOString() });
  if (eventBuffer.length >= config.batchSize) {
    flushEvents().catch(() => {});
  }
}

export function startSiemForwarder(): void {
  const config = getConfig();
  if (!config.enabled) return;
  flushTimer = setInterval(flushEvents, config.flushIntervalMs);
}

export function stopSiemForwarder(): void {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  // Final flush
  flushEvents().catch(() => {});
}
