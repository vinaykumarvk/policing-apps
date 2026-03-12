import { query } from "../db";
import { logInfo } from "../logger";

/** Generate an anonymized trend snapshot for cross-jurisdiction sharing */
export async function generateAnonymizedSnapshot(
  unitId: string, periodHours = 24,
): Promise<Record<string, unknown>> {
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - periodHours * 60 * 60 * 1000);

  const trends = await query(
    `SELECT term_type, term_value, category, SUM(occurrence_count) AS total_count
     FROM detection_trend
     WHERE unit_id = $1
       AND time_bucket >= $2
       AND time_bucket <= $3
     GROUP BY term_type, term_value, category
     ORDER BY total_count DESC
     LIMIT 50`,
    [unitId, periodStart.toISOString(), periodEnd.toISOString()],
  );

  return {
    sourceUnitId: unitId,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    trends: trends.rows.map((r) => ({
      termType: r.term_type,
      termValue: r.term_value,
      category: r.category,
      count: Number(r.total_count),
    })),
  };
}

/** Share a snapshot to the shared_trend_snapshot table */
export async function shareSnapshot(
  unitId: string, periodHours = 24,
): Promise<string> {
  const snapshot = await generateAnonymizedSnapshot(unitId, periodHours);
  const result = await query(
    `INSERT INTO shared_trend_snapshot (source_unit_id, period_start, period_end, trend_data)
     VALUES ($1, $2, $3, $4)
     RETURNING snapshot_id`,
    [unitId, snapshot.periodStart, snapshot.periodEnd, JSON.stringify(snapshot.trends)],
  );
  logInfo("TREND_SNAPSHOT_SHARED", { unitId, snapshotId: result.rows[0].snapshot_id });
  return result.rows[0].snapshot_id;
}

/** Get shared trends from other jurisdictions */
export async function getSharedTrends(
  excludeUnitId?: string, limit = 20,
): Promise<Array<Record<string, unknown>>> {
  let whereClause = "";
  const params: unknown[] = [limit];
  if (excludeUnitId) {
    whereClause = "WHERE source_unit_id != $2";
    params.push(excludeUnitId);
  }

  const result = await query(
    `SELECT s.snapshot_id, s.source_unit_id, ou.unit_name AS source_unit_name,
            s.period_start, s.period_end, s.trend_data, s.created_at
     FROM shared_trend_snapshot s
     LEFT JOIN organization_unit ou ON ou.unit_id = s.source_unit_id
     ${whereClause}
     ORDER BY s.created_at DESC
     LIMIT $1`,
    params,
  );
  return result.rows;
}
