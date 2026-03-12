-- Migration 057: Entity Layer — Extended entity tables
-- bank_account, device, vehicle, address, social_account + remaining link tables

-- ─── Bank Account ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bank_account (
  account_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_number   VARCHAR(30),
  ifsc_code        VARCHAR(11),
  upi_id           VARCHAR(100),
  normalized_key   VARCHAR(150) NOT NULL,
  bank_name        VARCHAR(200),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_normalized ON bank_account(normalized_key);

-- ─── Device ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS device (
  device_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imei             VARCHAR(20) NOT NULL,
  normalized_imei  VARCHAR(15) NOT NULL,
  device_model     VARCHAR(200),
  manufacturer     VARCHAR(100),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_device_imei ON device(normalized_imei);

-- ─── Vehicle ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vehicle (
  vehicle_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_no  VARCHAR(20) NOT NULL,
  normalized_reg   VARCHAR(20) NOT NULL,
  make             VARCHAR(100),
  model            VARCHAR(100),
  color            VARCHAR(50),
  vehicle_type     VARCHAR(30),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicle_reg ON vehicle(normalized_reg);

-- ─── Address ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS address (
  address_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_address      TEXT,
  district         VARCHAR(100),
  state            VARCHAR(100),
  pincode          VARCHAR(10),
  latitude         NUMERIC(10,7),
  longitude        NUMERIC(10,7),
  address_type     VARCHAR(30) DEFAULT 'RESIDENTIAL'
    CHECK (address_type IN ('RESIDENTIAL', 'OFFICE', 'HIDEOUT', 'OPERATIONAL', 'TEMPORARY', 'UNKNOWN')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_address_pincode ON address(pincode);
CREATE INDEX IF NOT EXISTS idx_address_district ON address(district);

-- ─── Social Account ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS social_account (
  social_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform           VARCHAR(50) NOT NULL,
  handle             VARCHAR(200) NOT NULL,
  normalized_handle  VARCHAR(200) NOT NULL,
  profile_url        TEXT,
  risk_score         NUMERIC(5,2),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_social_normalized ON social_account(platform, normalized_handle);

-- ─── Subject–Account Link ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subject_account_link (
  link_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id     UUID NOT NULL REFERENCES subject_profile(subject_id) ON DELETE CASCADE,
  account_id     UUID NOT NULL REFERENCES bank_account(account_id) ON DELETE CASCADE,
  relationship   VARCHAR(30) NOT NULL DEFAULT 'HOLDER'
    CHECK (relationship IN ('HOLDER', 'BENEFICIARY', 'SENDER', 'RECEIVER', 'SUSPECTED')),
  confidence     NUMERIC(5,2) DEFAULT 100,
  source_system  VARCHAR(50),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sal_subject ON subject_account_link(subject_id);
CREATE INDEX IF NOT EXISTS idx_sal_account ON subject_account_link(account_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sal_unique ON subject_account_link(subject_id, account_id, relationship);

-- ─── Subject–Device Link ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subject_device_link (
  link_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id     UUID NOT NULL REFERENCES subject_profile(subject_id) ON DELETE CASCADE,
  device_id      UUID NOT NULL REFERENCES device(device_id) ON DELETE CASCADE,
  relationship   VARCHAR(30) NOT NULL DEFAULT 'OWNER'
    CHECK (relationship IN ('OWNER', 'USER', 'SUSPECTED')),
  confidence     NUMERIC(5,2) DEFAULT 100,
  source_system  VARCHAR(50),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sdl_subject ON subject_device_link(subject_id);
CREATE INDEX IF NOT EXISTS idx_sdl_device ON subject_device_link(device_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sdl_unique ON subject_device_link(subject_id, device_id, relationship);

-- ─── Subject–Vehicle Link ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subject_vehicle_link (
  link_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id     UUID NOT NULL REFERENCES subject_profile(subject_id) ON DELETE CASCADE,
  vehicle_id     UUID NOT NULL REFERENCES vehicle(vehicle_id) ON DELETE CASCADE,
  relationship   VARCHAR(30) NOT NULL DEFAULT 'OWNER'
    CHECK (relationship IN ('OWNER', 'USER', 'SUSPECTED')),
  confidence     NUMERIC(5,2) DEFAULT 100,
  source_system  VARCHAR(50),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_svl_subject ON subject_vehicle_link(subject_id);
CREATE INDEX IF NOT EXISTS idx_svl_vehicle ON subject_vehicle_link(vehicle_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_svl_unique ON subject_vehicle_link(subject_id, vehicle_id, relationship);

-- ─── Subject–Address Link ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subject_address_link (
  link_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id     UUID NOT NULL REFERENCES subject_profile(subject_id) ON DELETE CASCADE,
  address_id     UUID NOT NULL REFERENCES address(address_id) ON DELETE CASCADE,
  relationship   VARCHAR(30) NOT NULL DEFAULT 'RESIDENT'
    CHECK (relationship IN ('RESIDENT', 'WORK', 'HIDEOUT', 'FREQUENT', 'SUSPECTED')),
  is_current     BOOLEAN DEFAULT TRUE,
  source_system  VARCHAR(50),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sadl_subject ON subject_address_link(subject_id);
CREATE INDEX IF NOT EXISTS idx_sadl_address ON subject_address_link(address_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sadl_unique ON subject_address_link(subject_id, address_id, relationship);

-- ─── Subject–Social Link ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subject_social_link (
  link_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id     UUID NOT NULL REFERENCES subject_profile(subject_id) ON DELETE CASCADE,
  social_id      UUID NOT NULL REFERENCES social_account(social_id) ON DELETE CASCADE,
  relationship   VARCHAR(30) NOT NULL DEFAULT 'OWNER'
    CHECK (relationship IN ('OWNER', 'SUSPECTED', 'ALIAS')),
  confidence     NUMERIC(5,2) DEFAULT 100,
  source_system  VARCHAR(50),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_socl_subject ON subject_social_link(subject_id);
CREATE INDEX IF NOT EXISTS idx_socl_social ON subject_social_link(social_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_socl_unique ON subject_social_link(subject_id, social_id, relationship);
