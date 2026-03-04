-- Tier 4C: Geo-Fencing & Tower Dump Analytics
-- Note: PostGIS extension would be needed for real polygon operations
-- Using simplified lat/lng bounding box approach for now

CREATE TABLE IF NOT EXISTS geofence (
  geofence_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  fence_type TEXT NOT NULL DEFAULT 'POLYGON' CHECK (fence_type IN ('POLYGON','CIRCLE','RECTANGLE')),
  coordinates JSONB NOT NULL, -- Array of {lat, lng} points for polygon, or {center: {lat,lng}, radius_m} for circle
  is_active BOOLEAN DEFAULT true,
  alert_on_entry BOOLEAN DEFAULT true,
  alert_on_exit BOOLEAN DEFAULT false,
  created_by UUID,
  unit_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_geofence_active ON geofence(is_active);
CREATE INDEX IF NOT EXISTS idx_geofence_unit ON geofence(unit_id);

CREATE TABLE IF NOT EXISTS geofence_event (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  geofence_id UUID NOT NULL REFERENCES geofence(geofence_id),
  entity_type TEXT,
  entity_id UUID,
  event_type TEXT NOT NULL CHECK (event_type IN ('ENTRY','EXIT','DWELL')),
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_geofence_event_fence ON geofence_event(geofence_id);
CREATE INDEX IF NOT EXISTS idx_geofence_event_time ON geofence_event(created_at DESC);

CREATE TABLE IF NOT EXISTS tower_dump (
  dump_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tower_id TEXT NOT NULL,
  tower_name TEXT,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  dump_date DATE,
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING','PROCESSING','COMPLETED','FAILED')),
  total_records INTEGER DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tower_dump_status ON tower_dump(status);

CREATE TABLE IF NOT EXISTS tower_dump_record (
  record_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dump_id UUID NOT NULL REFERENCES tower_dump(dump_id),
  msisdn TEXT NOT NULL, -- phone number
  imei TEXT,
  call_time TIMESTAMPTZ,
  duration_seconds INTEGER,
  call_type TEXT, -- INCOMING, OUTGOING, SMS_IN, SMS_OUT, DATA
  other_party TEXT,
  frequency INTEGER DEFAULT 1, -- count of calls to/from this number
  rank INTEGER -- computed rank by frequency
);
CREATE INDEX IF NOT EXISTS idx_tower_record_dump ON tower_dump_record(dump_id);
CREATE INDEX IF NOT EXISTS idx_tower_record_msisdn ON tower_dump_record(msisdn);
CREATE INDEX IF NOT EXISTS idx_tower_record_rank ON tower_dump_record(dump_id, rank);
