import { query } from "../db";
import { createRetryHandler } from "@puda/api-integrations";

const DOPAMS_API_URL = process.env.DOPAMS_API_URL || "http://localhost:3001";
const MAX_RETRIES = 3;

const retryHandler = createRetryHandler({
  maxRetries: MAX_RETRIES,
  baseDelayMs: 2000,
  maxDelayMs: 30000,
});

export interface SyncPayload {
  caseId: string;
  caseNumber: string;
  findings: Array<{
    findingId: string;
    title: string;
    severity: string;
    description: string;
    confidence: number;
  }>;
  entities: Array<{
    entityType: string;
    entityValue: string;
  }>;
  syncedAt: string;
}

/**
 * Serialize case findings and entities into sync payload.
 */
export async function buildSyncPayload(caseId: string): Promise<SyncPayload> {
  const caseResult = await query(
    `SELECT case_id, case_number, dopams_case_ref FROM forensic_case WHERE case_id = $1`,
    [caseId],
  );
  if (caseResult.rows.length === 0) throw new Error(`Case ${caseId} not found`);

  const findingsResult = await query(
    `SELECT finding_id, title, severity, description, confidence
     FROM ai_finding WHERE case_id = $1 AND state_id IN ('CONFIRMED', 'REVIEWED')`,
    [caseId],
  );

  const entitiesResult = await query(
    `SELECT entity_type, entity_value FROM extracted_entity WHERE case_id = $1`,
    [caseId],
  );

  return {
    caseId,
    caseNumber: caseResult.rows[0].case_number,
    findings: findingsResult.rows.map((r) => ({
      findingId: r.finding_id,
      title: r.title,
      severity: r.severity,
      description: r.description,
      confidence: r.confidence,
    })),
    entities: entitiesResult.rows.map((r) => ({
      entityType: r.entity_type,
      entityValue: r.entity_value,
    })),
    syncedAt: new Date().toISOString(),
  };
}

/**
 * Send sync payload to DOPAMS API.
 * Stub implementation — in production, POST to DOPAMS webhook endpoint.
 */
async function postToDopams(payload: SyncPayload, webhookUrl?: string): Promise<{ status: number; body: string }> {
  const url = webhookUrl || `${DOPAMS_API_URL}/api/v1/forensic-sync`;

  // Stub: simulate HTTP POST
  // In production, use fetch() or an HTTP client
  console.log(`[dopams-sync] POST ${url} — ${payload.findings.length} findings, ${payload.entities.length} entities`);
  return { status: 200, body: JSON.stringify({ received: true }) };
}

/**
 * Execute DOPAMS sync for a forensic case.
 * Creates a sync event, sends the payload, records the result.
 */
export async function syncToDopams(caseId: string, userId: string, idempotencyKey?: string): Promise<Record<string, unknown>> {
  const payload = await buildSyncPayload(caseId);

  // FR-12 AC-03: Create sync event record with idempotency key
  const eventResult = await query(
    `INSERT INTO dopams_sync_event (case_id, sync_type, direction, status, payload_jsonb, idempotency_key)
     VALUES ($1, 'FINDINGS', 'OUTBOUND', 'PENDING', $2, $3)
     RETURNING sync_event_id`,
    [caseId, JSON.stringify(payload), idempotencyKey || null],
  );
  const syncEventId = eventResult.rows[0].sync_event_id;

  try {
    const response = await retryHandler.execute(
      () => postToDopams(payload),
      `dopams-sync-${caseId}`,
    );

    await query(
      `UPDATE dopams_sync_event SET status = 'COMPLETED', response_code = $1, response_body = $2
       WHERE sync_event_id = $3`,
      [response.status, response.body, syncEventId],
    );

    return { syncEventId, status: "COMPLETED", responseCode: response.status };
  } catch (err) {
    await query(
      `UPDATE dopams_sync_event SET status = 'FAILED', error_message = $1,
        retry_count = retry_count + 1,
        next_retry_at = NOW() + INTERVAL '5 minutes' * POWER(2, LEAST(retry_count, 6))
       WHERE sync_event_id = $2`,
      [String(err), syncEventId],
    );

    return { syncEventId, status: "FAILED", error: String(err) };
  }
}

/**
 * Retry failed sync events that are due.
 */
export async function retryFailedSyncs(): Promise<number> {
  const result = await query(
    `SELECT sync_event_id, case_id, payload_jsonb, webhook_url
     FROM dopams_sync_event
     WHERE status = 'FAILED' AND next_retry_at <= NOW() AND retry_count < $1
     ORDER BY next_retry_at
     LIMIT 10`,
    [MAX_RETRIES],
  );

  let retried = 0;
  for (const event of result.rows) {
    try {
      const response = await postToDopams(event.payload_jsonb, event.webhook_url);
      await query(
        `UPDATE dopams_sync_event SET status = 'COMPLETED', response_code = $1, response_body = $2
         WHERE sync_event_id = $3`,
        [response.status, response.body, event.sync_event_id],
      );
      retried++;
    } catch (err) {
      await query(
        `UPDATE dopams_sync_event SET retry_count = retry_count + 1,
          error_message = $1,
          next_retry_at = NOW() + INTERVAL '5 minutes' * POWER(2, LEAST(retry_count + 1, 6))
         WHERE sync_event_id = $2`,
        [String(err), event.sync_event_id],
      );
    }
  }

  return retried;
}
