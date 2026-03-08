import { query } from "../db";
import { logInfo, logWarn } from "../logger";

export interface RetentionStats {
  totalPolicies: number;
  nearingExpiry: number;
  expired: number;
  legalHolds: number;
}

/** Flag content items nearing their retention expiry window */
export async function flagNearingExpiry(): Promise<number> {
  const result = await query(
    `UPDATE content_item ci SET retention_expiry_warning = TRUE, updated_at = NOW()
     FROM data_retention_policy drp
     WHERE ci.retention_expiry_warning = FALSE
       AND drp.is_active = TRUE
       AND ci.created_at + (drp.retention_days || ' days')::interval
           - (COALESCE(drp.nearing_expiry_days, 30) || ' days')::interval <= NOW()
       AND ci.created_at + (drp.retention_days || ' days')::interval > NOW()
     RETURNING ci.content_id`,
  );
  const count = result.rowCount ?? 0;
  if (count > 0) {
    logInfo("RETENTION_WARNING_FLAGGED", { count });
  }
  return count;
}

/** Enforce retention by marking expired content for purge (respects legal holds) */
export async function enforceRetention(): Promise<number> {
  const result = await query(
    `UPDATE content_item ci SET auto_purge_eligible = TRUE, auto_purge_after = NOW(), updated_at = NOW()
     FROM data_retention_policy drp
     WHERE ci.auto_purge_eligible = FALSE
       AND drp.is_active = TRUE
       AND ci.created_at + (drp.retention_days || ' days')::interval <= NOW()
       AND NOT EXISTS (
         SELECT 1 FROM evidence_legal_hold elh
         JOIN evidence_item ei ON ei.evidence_id = elh.evidence_id
         WHERE ei.content_id = ci.content_id AND elh.is_active = TRUE
       )
     RETURNING ci.content_id`,
  );
  const count = result.rowCount ?? 0;
  if (count > 0) {
    logInfo("RETENTION_ENFORCED", { count });
  }
  return count;
}

/** Get retention dashboard stats */
export async function getRetentionDashboardStats(): Promise<RetentionStats> {
  const [policies, nearing, expired, holds] = await Promise.all([
    query("SELECT COUNT(*) AS c FROM data_retention_policy WHERE is_active = TRUE"),
    query("SELECT COUNT(*) AS c FROM content_item WHERE retention_expiry_warning = TRUE AND auto_purge_eligible = FALSE"),
    query("SELECT COUNT(*) AS c FROM content_item WHERE auto_purge_eligible = TRUE"),
    query("SELECT COUNT(*) AS c FROM evidence_legal_hold WHERE is_active = TRUE"),
  ]);
  return {
    totalPolicies: Number(policies.rows[0].c),
    nearingExpiry: Number(nearing.rows[0].c),
    expired: Number(expired.rows[0].c),
    legalHolds: Number(holds.rows[0].c),
  };
}

/** Run periodic retention check (called by scheduler) */
export async function runRetentionCheck(): Promise<void> {
  try {
    await flagNearingExpiry();
    await enforceRetention();
  } catch (err) {
    logWarn("Retention check failed", { error: String(err) });
  }
}
