import { query, getClient } from "./db";
import { executeTransition } from "./workflow-bridge";
import { logInfo, logError } from "./logger";

// Advisory lock ID unique to DOPAMS SLA scheduler — prevents duplicate runs across instances
const SLA_LOCK_ID = 900_001;
const AUTH_CLEANUP_INTERVAL = 100; // Run auth cleanup every 100 ticks (~100 minutes at 60s interval)

let intervalId: ReturnType<typeof setInterval> | null = null;
let tickCount = 0;

async function checkOverdueTasks(): Promise<void> {
  const client = await getClient();
  try {
    // Attempt a non-blocking advisory lock; if another instance holds it, skip this run
    const lockResult = await client.query("SELECT pg_try_advisory_lock($1) AS acquired", [SLA_LOCK_ID]);
    if (!lockResult.rows[0]?.acquired) {
      return; // Another instance is already running the SLA check
    }

    try {
      const result = await client.query(
        `SELECT t.task_id, t.entity_type, t.entity_id, t.state_id, t.sla_due_at
         FROM task t
         WHERE t.status IN ('PENDING', 'IN_PROGRESS')
           AND t.sla_due_at IS NOT NULL
           AND t.sla_due_at < NOW()
         ORDER BY t.sla_due_at ASC
         LIMIT 50`
      );
      for (const task of result.rows) {
        try {
          const transResult = await executeTransition(
            task.entity_id, task.entity_type, "AUTO_ESCALATE",
            "SYSTEM", "SYSTEM", ["SYSTEM"],
            "SLA breached – auto-escalated"
          );
          if (transResult.success) {
            logInfo("SLA auto-escalation executed", { entityId: task.entity_id, entityType: task.entity_type });
          }
        } catch (_err) {
          // AUTO_ESCALATE transition may not exist for all entity types — skip silently
        }
      }
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [SLA_LOCK_ID]);
    }
  } catch (err) {
    logError("SLA check failed", { error: String(err) });
  } finally {
    client.release();
  }
}

async function cleanupExpiredAuthData(): Promise<void> {
  try {
    const denylistResult = await query("DELETE FROM auth_token_denylist WHERE expires_at < NOW()");
    const sessionResult = await query("DELETE FROM auth_session_activity WHERE last_activity_at < NOW() - INTERVAL '1 hour'");
    const denylistCount = denylistResult.rowCount ?? 0;
    const sessionCount = sessionResult.rowCount ?? 0;
    if (denylistCount > 0 || sessionCount > 0) {
      logInfo("Auth cleanup completed", { expiredTokens: denylistCount, staleSessions: sessionCount });
    }
  } catch (err) {
    logError("Auth cleanup failed", { error: String(err) });
  }
}

export function startSlaScheduler(intervalMs = 60000): void {
  if (intervalId) return;
  logInfo("SLA scheduler started", { intervalMs });
  intervalId = setInterval(async () => {
    await checkOverdueTasks();
    tickCount++;
    if (tickCount % AUTH_CLEANUP_INTERVAL === 0) {
      await cleanupExpiredAuthData();
    }
  }, intervalMs);
  // Run once immediately
  checkOverdueTasks();
}

export function stopSlaScheduler(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logInfo("SLA scheduler stopped");
  }
}
