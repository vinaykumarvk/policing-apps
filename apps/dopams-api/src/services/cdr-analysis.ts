import { query } from "../db";

type DbRow = Record<string, unknown>;

interface StayLocation {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  stayStart: string;
  stayEnd: string;
  towerIds: string[];
  cdrCount: number;
}

interface RoutePoint {
  latitude: number;
  longitude: number;
  timestamp: string;
  towerId: string;
}

/**
 * Analyze CDR records for a subject — frequency, top contacts, call patterns
 */
export async function analyzeCDR(subjectId: string): Promise<DbRow> {
  const [totalResult, topContactsResult, callPatternResult] = await Promise.all([
    query(
      `SELECT COUNT(*)::int AS total_records,
              COUNT(DISTINCT called_number) AS unique_contacts,
              MIN(call_start) AS earliest,
              MAX(call_start) AS latest,
              SUM(duration_seconds)::int AS total_duration_seconds
       FROM cdr_record WHERE subject_id = $1`,
      [subjectId],
    ),
    query(
      `SELECT called_number, COUNT(*)::int AS call_count, SUM(duration_seconds)::int AS total_duration
       FROM cdr_record WHERE subject_id = $1
       GROUP BY called_number ORDER BY call_count DESC LIMIT 20`,
      [subjectId],
    ),
    query(
      `SELECT EXTRACT(HOUR FROM call_start)::int AS hour, COUNT(*)::int AS count
       FROM cdr_record WHERE subject_id = $1
       GROUP BY hour ORDER BY hour`,
      [subjectId],
    ),
  ]);

  return {
    summary: totalResult.rows[0] || {},
    topContacts: topContactsResult.rows,
    hourlyPattern: callPatternResult.rows,
  };
}

/**
 * Detect stay locations by clustering tower locations over time windows.
 * Groups consecutive CDR records hitting the same tower cluster into stays.
 */
export async function detectStayLocations(
  subjectId: string,
  minDurationMinutes = 30,
): Promise<StayLocation[]> {
  // Get CDR records with tower coordinates, ordered by time
  const result = await query(
    `SELECT c.cdr_id, c.call_start, c.calling_tower_id,
            t.latitude, t.longitude, t.tower_id
     FROM cdr_record c
     JOIN tower_location t ON c.calling_tower_id = t.tower_id
     WHERE c.subject_id = $1
     ORDER BY c.call_start`,
    [subjectId],
  );

  if (result.rows.length === 0) return [];

  const stays: StayLocation[] = [];
  let clusterStart = result.rows[0];
  let clusterTowers = new Set<string>([clusterStart.tower_id]);
  let clusterLats = [parseFloat(clusterStart.latitude)];
  let clusterLngs = [parseFloat(clusterStart.longitude)];
  let clusterCount = 1;
  let lastTime = new Date(clusterStart.call_start);

  for (let i = 1; i < result.rows.length; i++) {
    const row = result.rows[i];
    const lat = parseFloat(row.latitude);
    const lng = parseFloat(row.longitude);
    const centroidLat = clusterLats.reduce((a, b) => a + b, 0) / clusterLats.length;
    const centroidLng = clusterLngs.reduce((a, b) => a + b, 0) / clusterLngs.length;

    // Simple distance check (approximate km)
    const distKm = haversineKm(centroidLat, centroidLng, lat, lng);
    const rowTime = new Date(row.call_start);

    if (distKm <= 2) {
      // Same cluster
      clusterTowers.add(row.tower_id);
      clusterLats.push(lat);
      clusterLngs.push(lng);
      clusterCount++;
      lastTime = rowTime;
    } else {
      // End current cluster, check duration
      const durationMin = (lastTime.getTime() - new Date(clusterStart.call_start).getTime()) / 60000;
      if (durationMin >= minDurationMinutes) {
        stays.push({
          latitude: centroidLat,
          longitude: centroidLng,
          radiusMeters: Math.max(500, distKm * 1000),
          stayStart: clusterStart.call_start,
          stayEnd: lastTime.toISOString(),
          towerIds: Array.from(clusterTowers),
          cdrCount: clusterCount,
        });
      }
      // Start new cluster
      clusterStart = row;
      clusterTowers = new Set([row.tower_id]);
      clusterLats = [lat];
      clusterLngs = [lng];
      clusterCount = 1;
      lastTime = rowTime;
    }
  }

  // Final cluster
  const finalDurationMin = (lastTime.getTime() - new Date(clusterStart.call_start).getTime()) / 60000;
  if (finalDurationMin >= minDurationMinutes) {
    const centroidLat = clusterLats.reduce((a, b) => a + b, 0) / clusterLats.length;
    const centroidLng = clusterLngs.reduce((a, b) => a + b, 0) / clusterLngs.length;
    stays.push({
      latitude: centroidLat,
      longitude: centroidLng,
      radiusMeters: 500,
      stayStart: clusterStart.call_start,
      stayEnd: lastTime.toISOString(),
      towerIds: Array.from(clusterTowers),
      cdrCount: clusterCount,
    });
  }

  // Persist stay locations
  for (const stay of stays) {
    await query(
      `INSERT INTO stay_location (subject_id, latitude, longitude, radius_meters, stay_start, stay_end, tower_ids, cdr_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [subjectId, stay.latitude, stay.longitude, stay.radiusMeters, stay.stayStart, stay.stayEnd, stay.towerIds, stay.cdrCount],
    );
  }

  return stays;
}

/**
 * Build route map — ordered sequence of tower locations over a time range
 */
export async function buildRouteMap(
  subjectId: string,
  from?: string,
  to?: string,
): Promise<RoutePoint[]> {
  const result = await query(
    `SELECT c.call_start AS timestamp, t.latitude, t.longitude, t.tower_id
     FROM cdr_record c
     JOIN tower_location t ON c.calling_tower_id = t.tower_id
     WHERE c.subject_id = $1
       AND ($2::timestamptz IS NULL OR c.call_start >= $2)
       AND ($3::timestamptz IS NULL OR c.call_start <= $3)
     ORDER BY c.call_start`,
    [subjectId, from || null, to || null],
  );

  return result.rows.map((r) => ({
    latitude: parseFloat(r.latitude),
    longitude: parseFloat(r.longitude),
    timestamp: r.timestamp,
    towerId: r.tower_id,
  }));
}

/**
 * Create an async analysis job
 */
export async function createAnalysisJob(
  jobType: string,
  subjectId: string | null,
  parameters: Record<string, unknown>,
  createdBy: string,
): Promise<DbRow> {
  const result = await query(
    `INSERT INTO analysis_job (job_type, subject_id, parameters, created_by)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [jobType, subjectId, JSON.stringify(parameters), createdBy],
  );
  return result.rows[0];
}

export async function getAnalysisJob(jobId: string): Promise<DbRow | null> {
  const result = await query(`SELECT * FROM analysis_job WHERE job_id = $1`, [jobId]);
  return result.rows[0] || null;
}

export async function listAnalysisJobs(
  stateId?: string,
  limit = 50,
  offset = 0,
): Promise<{ jobs: DbRow[]; total: number }> {
  const result = await query(
    `SELECT *, COUNT(*) OVER() AS total_count
     FROM analysis_job
     WHERE ($1::text IS NULL OR state_id = $1)
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [stateId || null, limit, offset],
  );
  const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
  return { jobs: result.rows.map(({ total_count, ...r }) => r), total };
}

// Haversine formula — distance in km between two lat/lng points
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
