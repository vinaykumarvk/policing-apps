import { query } from "../db";
import { logInfo, logWarn } from "../logger";

/** Record a detection event into the hourly trend bucket */
export async function recordDetection(
  termType: string, termValue: string, category: string | null, unitId: string | null,
): Promise<void> {
  const bucket = new Date();
  bucket.setMinutes(0, 0, 0); // truncate to hour

  await query(
    `INSERT INTO detection_trend (term_type, term_value, category, time_bucket, unit_id, occurrence_count)
     VALUES ($1, $2, $3, $4, $5, 1)
     ON CONFLICT (term_type, term_value, time_bucket, unit_id)
     DO UPDATE SET occurrence_count = detection_trend.occurrence_count + 1, updated_at = NOW()`,
    [termType, termValue, category, bucket.toISOString(), unitId],
  );
}

/** Detect spikes by comparing current hour vs 7-day rolling average */
export async function detectSpikes(spikeThreshold = 3.0): Promise<number> {
  try {
    const currentHour = new Date();
    currentHour.setMinutes(0, 0, 0);

    const spikes = await query(
      `WITH current_counts AS (
         SELECT term_type, term_value, occurrence_count
         FROM detection_trend
         WHERE time_bucket = $1
       ),
       baseline AS (
         SELECT term_type, term_value, AVG(occurrence_count) AS avg_count
         FROM detection_trend
         WHERE time_bucket >= NOW() - INTERVAL '7 days'
           AND time_bucket < $1
         GROUP BY term_type, term_value
         HAVING AVG(occurrence_count) > 0
       )
       SELECT c.term_type, c.term_value, c.occurrence_count AS spike_count,
              b.avg_count AS baseline_count,
              c.occurrence_count::numeric / b.avg_count AS spike_ratio
       FROM current_counts c
       JOIN baseline b ON b.term_type = c.term_type AND b.term_value = c.term_value
       WHERE c.occurrence_count::numeric / b.avg_count >= $2`,
      [currentHour.toISOString(), spikeThreshold],
    );

    let created = 0;
    for (const spike of spikes.rows) {
      await query(
        `INSERT INTO trend_spike_alert (term_type, term_value, baseline_count, spike_count, spike_ratio, time_window)
         VALUES ($1, $2, $3, $4, $5, '1h')`,
        [spike.term_type, spike.term_value, spike.baseline_count, spike.spike_count, spike.spike_ratio],
      );
      created++;
    }

    if (created > 0) {
      logInfo("TREND_SPIKES_DETECTED", { count: created });
    }
    return created;
  } catch (err) {
    logWarn("Spike detection failed", { error: String(err) });
    return 0;
  }
}

/** Get trend data (time-series) for a specific term or all terms */
export async function getTrendData(
  filters?: { termType?: string; termValue?: string; hoursBack?: number },
): Promise<Array<Record<string, unknown>>> {
  const hoursBack = filters?.hoursBack || 168; // 7 days default
  let whereClause = "WHERE time_bucket >= NOW() - ($1 || ' hours')::interval";
  const params: unknown[] = [hoursBack];
  let paramIdx = 2;

  if (filters?.termType) {
    whereClause += ` AND term_type = $${paramIdx++}`;
    params.push(filters.termType);
  }
  if (filters?.termValue) {
    whereClause += ` AND term_value = $${paramIdx++}`;
    params.push(filters.termValue);
  }

  const result = await query(
    `SELECT term_type, term_value, category, time_bucket, SUM(occurrence_count) AS total_count
     FROM detection_trend ${whereClause}
     GROUP BY term_type, term_value, category, time_bucket
     ORDER BY time_bucket ASC`,
    params,
  );
  return result.rows;
}

/** Flag NPS candidates — unmatched terms with narcoticsScore > threshold */
export async function flagNpsCandidates(scoreThreshold = 30): Promise<number> {
  try {
    // Find trending terms not in slang_dictionary or known_drug_terms
    const result = await query(
      `INSERT INTO nps_candidate (term, occurrence_count, context_snippet)
       SELECT dt.term_value, SUM(dt.occurrence_count), 'Auto-flagged by trend analyzer'
       FROM detection_trend dt
       WHERE dt.term_type = 'UNKNOWN'
         AND dt.time_bucket >= NOW() - INTERVAL '24 hours'
         AND NOT EXISTS (
           SELECT 1 FROM slang_dictionary sd WHERE sd.term = dt.term_value AND sd.is_active = TRUE
         )
         AND NOT EXISTS (
           SELECT 1 FROM nps_candidate nc WHERE nc.term = dt.term_value AND nc.status = 'PENDING'
         )
       GROUP BY dt.term_value
       HAVING SUM(dt.occurrence_count) >= $1
       RETURNING nps_id`,
      [scoreThreshold],
    );

    const count = result.rowCount ?? 0;
    if (count > 0) {
      logInfo("NPS_CANDIDATES_FLAGGED", { count });
    }
    return count;
  } catch (err) {
    logWarn("NPS flagging failed", { error: String(err) });
    return 0;
  }
}
