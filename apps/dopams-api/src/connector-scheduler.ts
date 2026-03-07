import { createConnectorScheduler, createRetryHandler, createDeadLetterQueue } from "@puda/api-integrations";
import { query, getClient } from "./db";
import { CctnsAdapter } from "./connectors/cctns-adapter";
import { EcourtsAdapter } from "./connectors/ecourts-adapter";
import { NdpsAdapter } from "./connectors/ndps-adapter";
import { ingestRecords, createIngestionJob, completeIngestionJob } from "./connectors/ingestion-pipeline";
import type { DopamsSourceAdapter } from "./connectors/types";
import type { ConnectorItem } from "@puda/api-integrations";

const ADVISORY_LOCK_ID = 900_010;
const POLL_INTERVAL = parseInt(process.env.DOPAMS_POLL_INTERVAL_MS || "600000", 10);

const adapters: DopamsSourceAdapter[] = [
  new CctnsAdapter(),
  new EcourtsAdapter(),
  new NdpsAdapter(),
];

const retryHandler = createRetryHandler({
  maxRetries: 3,
  baseDelayMs: 2000,
  maxDelayMs: 30000,
});

const deadLetterQueue = createDeadLetterQueue({
  queryFn: query,
  tableName: "connector_dead_letter",
});

async function handleItems(items: ConnectorItem[], connectorName: string): Promise<void> {
  const adapter = adapters.find((a) => a.name === connectorName);
  if (!adapter) return;

  const normalized = adapter.normalize(items.map((i) => i.rawData));
  if (normalized.length === 0) return;

  const jobId = await createIngestionJob("system", "INCREMENTAL", "system", normalized.length);

  try {
    const result = await ingestRecords(normalized, jobId, connectorName);
    const finalState = result.errors > 0
      ? (result.inserted + result.updated > 0 ? "PARTIAL" : "FAILED")
      : "COMPLETED";
    await completeIngestionJob(jobId, finalState);

    // Update connector health
    await query(
      `UPDATE connector_config SET last_poll_at = NOW(), health_status = 'HEALTHY', error_count = 0
       WHERE connector_name = $1`,
      [connectorName],
    );

    console.log(`[dopams-ingest] ${connectorName}: inserted=${result.inserted} updated=${result.updated} errors=${result.errors}`);
  } catch (err) {
    await completeIngestionJob(jobId, "FAILED");

    // Update connector health on failure
    await query(
      `UPDATE connector_config SET error_count = error_count + 1,
        last_error = $1, health_status = CASE WHEN error_count >= 5 THEN 'DOWN' ELSE 'DEGRADED' END
       WHERE connector_name = $2`,
      [String(err), connectorName],
    );
    throw err;
  }
}

async function handleError(error: Error, connectorName: string): Promise<void> {
  console.error(`[dopams-ingest] Connector ${connectorName} error:`, error.message);

  // Enqueue to dead letter if repeated failures
  await deadLetterQueue.enqueue(
    { externalId: `error-${Date.now()}`, source: connectorName, contentType: "error", rawData: { message: error.message }, fetchedAt: new Date() },
    error.message,
    connectorName,
  );
}

const scheduler = createConnectorScheduler({
  connectors: adapters,
  queryFn: query,
  getClientFn: getClient,
  advisoryLockId: ADVISORY_LOCK_ID,
  intervalMs: POLL_INTERVAL,
  onItems: handleItems,
  onError: handleError,
  retryConfig: { maxRetries: 3, baseDelayMs: 2000, maxDelayMs: 30000 },
});

export function startIngestionScheduler(): void {
  scheduler.start();
  console.log(`[dopams-ingest] Scheduler started (interval=${POLL_INTERVAL}ms)`);
}

export function stopIngestionScheduler(): void {
  scheduler.stop();
}

export { retryHandler, deadLetterQueue };
