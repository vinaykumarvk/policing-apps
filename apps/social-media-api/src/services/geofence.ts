import { query } from "../db";

type DbRow = Record<string, unknown>;

interface FenceRow {
  fence_type: string;
  coordinates: { center?: { lat: number; lng: number }; radius_m?: number } | { lat: number; lng: number }[];
  geofence_id: string;
  alert_on_entry: boolean;
  alert_on_exit: boolean;
  name: string;
}

// Point-in-polygon test (ray casting algorithm)
function pointInPolygon(lat: number, lng: number, polygon: { lat: number; lng: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lat, yi = polygon[i].lng;
    const xj = polygon[j].lat, yj = polygon[j].lng;
    const intersect = ((yi > lng) !== (yj > lng)) && (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Haversine distance in meters
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isInsideFence(lat: number, lng: number, fence: FenceRow): boolean {
  const coords = fence.coordinates;
  if (fence.fence_type === "CIRCLE") {
    const circleCoords = coords as { center: { lat: number; lng: number }; radius_m?: number };
    const center = circleCoords.center;
    const dist = haversineDistance(lat, lng, center.lat, center.lng);
    return dist <= (circleCoords.radius_m || 1000);
  }
  if (fence.fence_type === "RECTANGLE") {
    const rectCoords = coords as { lat: number; lng: number }[];
    const [sw, ne] = [rectCoords[0], rectCoords[1]]; // SW corner, NE corner
    return lat >= sw.lat && lat <= ne.lat && lng >= sw.lng && lng <= ne.lng;
  }
  // POLYGON
  return pointInPolygon(lat, lng, coords as { lat: number; lng: number }[]);
}

// CRUD
export async function createGeofence(data: {
  name: string;
  description?: string;
  fenceType: string;
  coordinates: Record<string, unknown> | unknown[];
  alertOnEntry?: boolean;
  alertOnExit?: boolean;
  createdBy?: string;
  unitId?: string;
}): Promise<DbRow> {
  const result = await query(
    `INSERT INTO geofence (name, description, fence_type, coordinates, alert_on_entry, alert_on_exit, created_by, unit_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [data.name, data.description || null, data.fenceType, JSON.stringify(data.coordinates),
     data.alertOnEntry !== false, data.alertOnExit || false, data.createdBy || null, data.unitId || null]
  );
  return result.rows[0];
}

export async function listGeofences(unitId?: string | null): Promise<DbRow[]> {
  if (unitId) {
    const result = await query(`SELECT * FROM geofence WHERE is_active = true AND (unit_id = $1 OR unit_id IS NULL) ORDER BY created_at DESC`, [unitId]);
    return result.rows;
  }
  const result = await query(`SELECT * FROM geofence WHERE is_active = true ORDER BY created_at DESC`);
  return result.rows;
}

export async function getGeofence(geofenceId: string): Promise<DbRow | null> {
  const result = await query(`SELECT * FROM geofence WHERE geofence_id = $1`, [geofenceId]);
  return result.rows[0] || null;
}

export async function deleteGeofence(geofenceId: string): Promise<boolean> {
  const result = await query(`UPDATE geofence SET is_active = false, updated_at = now() WHERE geofence_id = $1`, [geofenceId]);
  return (result.rowCount ?? 0) > 0;
}

// Check a point against all active fences
export async function checkPoint(lat: number, lng: number, entityType?: string, entityId?: string): Promise<{ fence: string; event: DbRow }[]> {
  const fences = await query(`SELECT * FROM geofence WHERE is_active = true`);
  const triggers: { fence: string; event: DbRow }[] = [];

  for (const fence of fences.rows as unknown as FenceRow[]) {
    const inside = isInsideFence(lat, lng, fence);
    if (inside && fence.alert_on_entry) {
      const event = await query(
        `INSERT INTO geofence_event (geofence_id, entity_type, entity_id, event_type, latitude, longitude)
         VALUES ($1, $2, $3, 'ENTRY', $4, $5) RETURNING *`,
        [fence.geofence_id, entityType || null, entityId || null, lat, lng]
      );
      triggers.push({ fence: fence.name, event: event.rows[0] });
    }
  }

  return triggers;
}

export async function getGeofenceEvents(geofenceId: string, limit = 50): Promise<DbRow[]> {
  const result = await query(
    `SELECT * FROM geofence_event WHERE geofence_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [geofenceId, limit]
  );
  return result.rows;
}

// Tower dump operations
export async function createTowerDump(data: {
  towerId: string;
  towerName?: string;
  latitude?: number;
  longitude?: number;
  dumpDate?: string;
  createdBy?: string;
}): Promise<DbRow> {
  const result = await query(
    `INSERT INTO tower_dump (tower_id, tower_name, latitude, longitude, dump_date, created_by)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [data.towerId, data.towerName || null, data.latitude || null, data.longitude || null, data.dumpDate || null, data.createdBy || null]
  );
  return result.rows[0];
}

export async function uploadTowerDumpRecords(dumpId: string, records: { msisdn: string; imei?: string; callTime?: string; durationSeconds?: number; callType?: string; otherParty?: string }[]): Promise<{ imported: number }> {
  let imported = 0;

  for (const rec of records) {
    await query(
      `INSERT INTO tower_dump_record (dump_id, msisdn, imei, call_time, duration_seconds, call_type, other_party)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [dumpId, rec.msisdn, rec.imei || null, rec.callTime || null, rec.durationSeconds || null, rec.callType || null, rec.otherParty || null]
    );
    imported++;
  }

  // Compute frequency and rank
  await query(
    `WITH freq AS (
      SELECT msisdn, COUNT(*) as cnt FROM tower_dump_record WHERE dump_id = $1 GROUP BY msisdn
    )
    UPDATE tower_dump_record tdr SET
      frequency = freq.cnt,
      rank = (SELECT COUNT(*) + 1 FROM freq f2 WHERE f2.cnt > freq.cnt)
    FROM freq WHERE tdr.msisdn = freq.msisdn AND tdr.dump_id = $1`,
    [dumpId]
  );

  await query(`UPDATE tower_dump SET status = 'COMPLETED', total_records = $2 WHERE dump_id = $1`, [dumpId, imported]);

  return { imported };
}

export async function getTowerDump(dumpId: string): Promise<DbRow | null> {
  const dump = await query(`SELECT * FROM tower_dump WHERE dump_id = $1`, [dumpId]);
  return dump.rows[0] || null;
}

export async function getTowerDumpRanked(dumpId: string, limit = 50): Promise<DbRow[]> {
  const result = await query(
    `SELECT msisdn, imei, MAX(call_type) as call_type, COUNT(*) as frequency,
            SUM(duration_seconds) as total_duration,
            RANK() OVER (ORDER BY COUNT(*) DESC) as rank
     FROM tower_dump_record WHERE dump_id = $1
     GROUP BY msisdn, imei
     ORDER BY frequency DESC
     LIMIT $2`,
    [dumpId, limit]
  );
  return result.rows;
}

export async function listTowerDumps(): Promise<DbRow[]> {
  const result = await query(`SELECT * FROM tower_dump ORDER BY created_at DESC`);
  return result.rows;
}
