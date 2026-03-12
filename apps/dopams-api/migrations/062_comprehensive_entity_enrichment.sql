-- Migration 062: Comprehensive Criminal Intelligence Entity Enrichment
-- Sources: CCTNS/NIDAAN, NIEM Justice Domain, FBI NCIC, INTERPOL, NDPS Act, UNODC
-- Enriches all entity tables and creates missing normalized tables for:
--   family members, FIR records, seizure records, warrants, property/assets,
--   location sightings, UPI accounts, crypto wallets, and drug intelligence profile.

BEGIN;

-- ============================================================================
-- 1. ENRICH subject_profile — Drug Intelligence & Extended Demographics
-- ============================================================================
ALTER TABLE subject_profile
  -- Bilingual / Extended Identity
  ADD COLUMN IF NOT EXISTS full_name_local       text,
  ADD COLUMN IF NOT EXISTS place_of_birth        text,
  -- Extended Physical Description (NCIC personal descriptors)
  ADD COLUMN IF NOT EXISTS build                 varchar(20) CHECK (build IS NULL OR build IN ('SMALL','MEDIUM','LARGE','HEAVY','THIN')),
  ADD COLUMN IF NOT EXISTS eye_color             varchar(20),
  ADD COLUMN IF NOT EXISTS hair_color            varchar(20),
  ADD COLUMN IF NOT EXISTS facial_hair           varchar(50),
  ADD COLUMN IF NOT EXISTS scars                 jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS tattoos               jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS handedness            varchar(15) CHECK (handedness IS NULL OR handedness IN ('LEFT','RIGHT','AMBIDEXTROUS')),
  ADD COLUMN IF NOT EXISTS speech_pattern        text,
  -- Biometric References
  ADD COLUMN IF NOT EXISTS fingerprint_nfn       varchar(20),
  ADD COLUMN IF NOT EXISTS dna_profile_id        varchar(50),
  -- Cross-System IDs
  ADD COLUMN IF NOT EXISTS nidaan_id             varchar(50),
  ADD COLUMN IF NOT EXISTS interpol_notice_ref   varchar(50),
  ADD COLUMN IF NOT EXISTS ncb_reference         varchar(50),
  -- Drug Intelligence Profile
  ADD COLUMN IF NOT EXISTS drug_types_dealt      text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS primary_drug          varchar(100),
  ADD COLUMN IF NOT EXISTS supply_chain_position varchar(30) CHECK (supply_chain_position IS NULL OR supply_chain_position IN (
    'CULTIVATOR','MANUFACTURER','PROCESSOR','WHOLESALER','DISTRIBUTOR','RETAILER','COURIER','CONSUMER','FINANCIER')),
  ADD COLUMN IF NOT EXISTS operational_level     varchar(20) CHECK (operational_level IS NULL OR operational_level IN (
    'INTERNATIONAL','INTER_STATE','INTRA_STATE','DISTRICT','LOCAL')),
  ADD COLUMN IF NOT EXISTS territory_description text,
  ADD COLUMN IF NOT EXISTS territory_districts   text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS territory_states      text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS typical_quantity       text,
  ADD COLUMN IF NOT EXISTS quantity_category     varchar(30) CHECK (quantity_category IS NULL OR quantity_category IN (
    'SMALL','LESS_THAN_COMMERCIAL','COMMERCIAL','LARGE_COMMERCIAL')),
  ADD COLUMN IF NOT EXISTS concealment_methods   text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS transport_routes      jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS communication_methods text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS known_code_words      jsonb DEFAULT '{}',
  -- Custody / Recidivism
  ADD COLUMN IF NOT EXISTS total_convictions     integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_acquittals      integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_arrested_at      timestamptz,
  ADD COLUMN IF NOT EXISTS is_recidivist         boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS custody_status        varchar(30) CHECK (custody_status IS NULL OR custody_status IN (
    'FREE','IN_JUDICIAL_CUSTODY','IN_POLICE_CUSTODY','ON_BAIL','ON_PAROLE','RELEASED','ABSCONDING','SURRENDERED','DECEASED')),
  ADD COLUMN IF NOT EXISTS jail_name             varchar(200),
  ADD COLUMN IF NOT EXISTS is_proclaimed_offender boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_habitual_offender  boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_subject_supply_chain ON subject_profile (supply_chain_position) WHERE supply_chain_position IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subject_custody ON subject_profile (custody_status) WHERE custody_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subject_recidivist ON subject_profile (is_recidivist) WHERE is_recidivist = true;

-- ============================================================================
-- 2. ENRICH phone_number — CDR/IMEI metadata
-- ============================================================================
ALTER TABLE phone_number
  ADD COLUMN IF NOT EXISTS imei              varchar(20),
  ADD COLUMN IF NOT EXISTS imsi              varchar(20),
  ADD COLUMN IF NOT EXISTS sim_iccid         varchar(22),
  ADD COLUMN IF NOT EXISTS is_active         boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_active_at    timestamptz,
  ADD COLUMN IF NOT EXISTS registered_name   text,
  ADD COLUMN IF NOT EXISTS messaging_apps    text[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_phone_imei ON phone_number (imei) WHERE imei IS NOT NULL;

-- ============================================================================
-- 3. ENRICH address — Structured Indian address fields
-- ============================================================================
ALTER TABLE address
  ADD COLUMN IF NOT EXISTS address_line_1  text,
  ADD COLUMN IF NOT EXISTS address_line_2  text,
  ADD COLUMN IF NOT EXISTS village_town    varchar(200),
  ADD COLUMN IF NOT EXISTS tehsil         varchar(200),
  ADD COLUMN IF NOT EXISTS country        varchar(50) DEFAULT 'India',
  ADD COLUMN IF NOT EXISTS verified_at    timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by    uuid;

-- Expand address_type CHECK constraint to include drug enforcement types
-- Drop the old CHECK and re-add with expanded values
DO $$ BEGIN
  ALTER TABLE address DROP CONSTRAINT IF EXISTS address_address_type_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
ALTER TABLE address ADD CONSTRAINT address_address_type_check
  CHECK (address_type IS NULL OR address_type IN (
    'RESIDENTIAL','PERMANENT','OFFICE','HIDEOUT','SAFEHOUSE','OPERATIONAL',
    'STASH_HOUSE','MANUFACTURING_LAB','FREQUENT_HANGOUT','TEMPORARY','UNKNOWN'));

-- ============================================================================
-- 4. ENRICH social_account — Full social media intelligence
-- ============================================================================
ALTER TABLE social_account
  ADD COLUMN IF NOT EXISTS display_name          text,
  ADD COLUMN IF NOT EXISTS profile_photo_url     text,
  ADD COLUMN IF NOT EXISTS bio_text              text,
  ADD COLUMN IF NOT EXISTS follower_count        integer,
  ADD COLUMN IF NOT EXISTS following_count       integer,
  ADD COLUMN IF NOT EXISTS post_count            integer,
  ADD COLUMN IF NOT EXISTS is_verified           boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_private            boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS linked_phone          varchar(30),
  ADD COLUMN IF NOT EXISTS linked_email          varchar(200),
  ADD COLUMN IF NOT EXISTS activity_status       varchar(20) DEFAULT 'UNKNOWN'
    CHECK (activity_status IS NULL OR activity_status IN ('ACTIVE','INACTIVE','SUSPENDED','DELETED','UNKNOWN')),
  ADD COLUMN IF NOT EXISTS last_post_at          timestamptz,
  ADD COLUMN IF NOT EXISTS flagged_content_count integer DEFAULT 0;

-- ============================================================================
-- 5. ENRICH bank_account — PMLA/financial investigation fields
-- ============================================================================
ALTER TABLE bank_account
  ADD COLUMN IF NOT EXISTS branch_name                varchar(200),
  ADD COLUMN IF NOT EXISTS account_type               varchar(30)
    CHECK (account_type IS NULL OR account_type IN ('SAVINGS','CURRENT','FIXED_DEPOSIT','RECURRING','NRI','OTHER')),
  ADD COLUMN IF NOT EXISTS account_holder_name        text,
  ADD COLUMN IF NOT EXISTS is_joint_account           boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS opening_date               date,
  ADD COLUMN IF NOT EXISTS is_frozen                  boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS frozen_by                  text,
  ADD COLUMN IF NOT EXISTS frozen_at                  timestamptz,
  ADD COLUMN IF NOT EXISTS average_monthly_balance    numeric(15,2),
  ADD COLUMN IF NOT EXISTS suspicious_transaction_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS statement_available        boolean DEFAULT false;

-- ============================================================================
-- 6. ENRICH vehicle — Vahan database + surveillance fields
-- ============================================================================
ALTER TABLE vehicle
  ADD COLUMN IF NOT EXISTS year_of_manufacture     integer,
  ADD COLUMN IF NOT EXISTS engine_number           varchar(50),
  ADD COLUMN IF NOT EXISTS chassis_number          varchar(50),
  ADD COLUMN IF NOT EXISTS fuel_type               varchar(20)
    CHECK (fuel_type IS NULL OR fuel_type IN ('PETROL','DIESEL','CNG','ELECTRIC','HYBRID')),
  ADD COLUMN IF NOT EXISTS registered_owner_name   text,
  ADD COLUMN IF NOT EXISTS registered_owner_address text,
  ADD COLUMN IF NOT EXISTS insurance_policy_number varchar(50),
  ADD COLUMN IF NOT EXISTS insurance_valid_until   date,
  ADD COLUMN IF NOT EXISTS is_stolen               boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_under_surveillance   boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_known_location     text,
  ADD COLUMN IF NOT EXISTS last_seen_at            timestamptz;

CREATE INDEX IF NOT EXISTS idx_vehicle_chassis ON vehicle (chassis_number) WHERE chassis_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vehicle_engine ON vehicle (engine_number) WHERE engine_number IS NOT NULL;

-- ============================================================================
-- 7. ENRICH device — Digital forensics fields
-- ============================================================================
ALTER TABLE device
  ADD COLUMN IF NOT EXISTS imei_2                    varchar(20),
  ADD COLUMN IF NOT EXISTS serial_number             varchar(100),
  ADD COLUMN IF NOT EXISTS device_type               varchar(30)
    CHECK (device_type IS NULL OR device_type IN (
      'SMARTPHONE','FEATURE_PHONE','TABLET','LAPTOP','DESKTOP','HARD_DRIVE','USB_DRIVE','SIM_CARD','MEMORY_CARD','OTHER')),
  ADD COLUMN IF NOT EXISTS operating_system          varchar(50),
  ADD COLUMN IF NOT EXISTS mac_address               varchar(20),
  ADD COLUMN IF NOT EXISTS is_encrypted              boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS lock_type                 varchar(20)
    CHECK (lock_type IS NULL OR lock_type IN ('PIN','PATTERN','FINGERPRINT','FACE','NONE','UNKNOWN')),
  ADD COLUMN IF NOT EXISTS forensic_extraction_status varchar(20) DEFAULT 'NOT_STARTED'
    CHECK (forensic_extraction_status IS NULL OR forensic_extraction_status IN (
      'NOT_STARTED','IN_PROGRESS','COMPLETED','FAILED','NOT_POSSIBLE')),
  ADD COLUMN IF NOT EXISTS extraction_tool           varchar(100),
  ADD COLUMN IF NOT EXISTS extraction_date           timestamptz,
  ADD COLUMN IF NOT EXISTS evidence_reference        text;

-- ============================================================================
-- 8. ENRICH subject_subject_link — Expanded relationship types + metadata
-- ============================================================================
ALTER TABLE subject_subject_link
  ADD COLUMN IF NOT EXISTS first_observed_at       timestamptz,
  ADD COLUMN IF NOT EXISTS last_observed_at        timestamptz,
  ADD COLUMN IF NOT EXISTS is_active               boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS communication_frequency varchar(20)
    CHECK (communication_frequency IS NULL OR communication_frequency IN ('DAILY','WEEKLY','MONTHLY','OCCASIONAL','UNKNOWN')),
  ADD COLUMN IF NOT EXISTS notes                   text;

-- Expand relationship CHECK to include drug network roles
DO $$ BEGIN
  ALTER TABLE subject_subject_link DROP CONSTRAINT IF EXISTS subject_subject_link_relationship_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
ALTER TABLE subject_subject_link ADD CONSTRAINT subject_subject_link_relationship_check
  CHECK (relationship IS NULL OR relationship IN (
    'ASSOCIATE','FAMILY','GANG','CO_ACCUSED','SUPPLIER','BUYER','UNKNOWN',
    'COURIER','FINANCIER','HANDLER','MULE','RECRUITER','CELLMATE',
    'JAIL_VISITOR','INFORMANT','LANDLORD','LAWYER','CUSTOMER'));

-- ============================================================================
-- 9. NEW TABLE: subject_family_member
-- ============================================================================
CREATE TABLE IF NOT EXISTS subject_family_member (
  family_member_id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id         uuid NOT NULL REFERENCES subject_profile(subject_id) ON DELETE CASCADE,
  relative_subject_id uuid REFERENCES subject_profile(subject_id),
  relationship_type  varchar(30) NOT NULL CHECK (relationship_type IN (
    'FATHER','MOTHER','SPOUSE','BROTHER','SISTER','SON','DAUGHTER',
    'UNCLE','AUNT','COUSIN','GRANDPARENT','IN_LAW','STEP_PARENT','STEP_SIBLING','OTHER')),
  full_name          text NOT NULL,
  contact_phone      varchar(30),
  contact_address    text,
  age                integer CHECK (age IS NULL OR (age >= 0 AND age <= 120)),
  gender             varchar(20),
  occupation         text,
  is_aware_of_activity  boolean DEFAULT false,
  is_involved           boolean DEFAULT false,
  is_dependent          boolean DEFAULT false,
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT NOW(),
  updated_at         timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_family_subject ON subject_family_member (subject_id);

-- ============================================================================
-- 10. NEW TABLE: fir_record — First Information Report per subject
-- ============================================================================
CREATE TABLE IF NOT EXISTS fir_record (
  fir_record_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id         uuid NOT NULL REFERENCES subject_profile(subject_id) ON DELETE CASCADE,
  case_id            uuid REFERENCES dopams_case(case_id),
  fir_number         varchar(50) NOT NULL,
  fir_date           date,
  police_station     varchar(200),
  district           varchar(100),
  state              varchar(100),
  sections_of_law    text[] DEFAULT '{}',
  role_in_case       varchar(30) CHECK (role_in_case IS NULL OR role_in_case IN (
    'ACCUSED','WITNESS','COMPLAINANT','ABSCONDER','SUSPECT')),
  arrest_date        date,
  arresting_agency   varchar(100),
  charge_sheet_date  date,
  charge_sheet_number varchar(50),
  -- Court tracking
  court_name         text,
  court_case_number  varchar(100),
  case_stage         varchar(30) CHECK (case_stage IS NULL OR case_stage IN (
    'INVESTIGATION','CHARGE_SHEET','TRIAL','ARGUMENTS','JUDGMENT','APPEAL','CLOSED')),
  next_hearing_date  date,
  verdict            varchar(30) CHECK (verdict IS NULL OR verdict IN (
    'PENDING','CONVICTED','ACQUITTED','DISCHARGED','COMPOUNDED','ABATED')),
  sentence_details   text,
  sentence_start_date date,
  sentence_end_date  date,
  fine_amount        numeric(15,2),
  -- Bail
  bail_type          varchar(30) CHECK (bail_type IS NULL OR bail_type IN (
    'REGULAR','ANTICIPATORY','INTERIM','DEFAULT','NONE')),
  bail_date          date,
  bail_conditions    text,
  surety_details     text,
  -- Metadata
  source_system      varchar(50),
  created_at         timestamptz NOT NULL DEFAULT NOW(),
  updated_at         timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fir_subject ON fir_record (subject_id);
CREATE INDEX IF NOT EXISTS idx_fir_number ON fir_record (fir_number);
CREATE INDEX IF NOT EXISTS idx_fir_hearing ON fir_record (next_hearing_date) WHERE next_hearing_date IS NOT NULL;

-- ============================================================================
-- 11. NEW TABLE: seizure_record — Drug/contraband seizure tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS seizure_record (
  seizure_id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id         uuid NOT NULL REFERENCES subject_profile(subject_id) ON DELETE CASCADE,
  case_id            uuid REFERENCES dopams_case(case_id),
  fir_record_id      uuid REFERENCES fir_record(fir_record_id),
  seizure_date       timestamptz NOT NULL,
  seizure_location   text,
  seizing_officer    text,
  seizing_agency     varchar(100),
  -- Drug details
  drug_type          varchar(100) NOT NULL,
  gross_weight_grams numeric(10,3),
  net_weight_grams   numeric(10,3),
  purity_percentage  numeric(5,2),
  estimated_street_value numeric(15,2),
  quantity_category  varchar(30) CHECK (quantity_category IS NULL OR quantity_category IN (
    'SMALL','LESS_THAN_COMMERCIAL','COMMERCIAL','LARGE_COMMERCIAL')),
  -- Testing
  field_test_result  text,
  fsl_report_number  varchar(100),
  fsl_result         text,
  -- Storage
  godown_deposit_date timestamptz,
  godown_reference   text,
  panchnama_reference text,
  panch_witness_names text[] DEFAULT '{}',
  sealed_package_count integer,
  disposal_status    varchar(30) DEFAULT 'IN_STORAGE' CHECK (disposal_status IN (
    'IN_STORAGE','SAMPLE_RETAINED','DISPOSED','PENDING_COURT_ORDER')),
  -- Metadata
  created_at         timestamptz NOT NULL DEFAULT NOW(),
  updated_at         timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_seizure_subject ON seizure_record (subject_id);
CREATE INDEX IF NOT EXISTS idx_seizure_date ON seizure_record (seizure_date DESC);
CREATE INDEX IF NOT EXISTS idx_seizure_drug_type ON seizure_record (drug_type);

-- ============================================================================
-- 12. NEW TABLE: warrant_record — Warrants & detention orders
-- ============================================================================
CREATE TABLE IF NOT EXISTS warrant_record (
  warrant_id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id         uuid NOT NULL REFERENCES subject_profile(subject_id) ON DELETE CASCADE,
  fir_record_id      uuid REFERENCES fir_record(fir_record_id),
  warrant_type       varchar(30) NOT NULL CHECK (warrant_type IN (
    'ARREST','BAILABLE','NON_BAILABLE','PROCLAIMED_OFFENDER','NBW','PRODUCTION','SEARCH','PITNDPS')),
  warrant_number     varchar(100),
  warrant_date       date,
  issuing_court      text,
  issuing_authority  text,
  is_executed        boolean DEFAULT false,
  executed_at        timestamptz,
  executed_by        text,
  -- PIT-NDPS specific
  pitndps_order_number varchar(100),
  pitndps_order_date   date,
  detention_period_days integer,
  -- Status
  status             varchar(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','EXECUTED','EXPIRED','WITHDRAWN')),
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT NOW(),
  updated_at         timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_warrant_subject ON warrant_record (subject_id);
CREATE INDEX IF NOT EXISTS idx_warrant_active ON warrant_record (status) WHERE status = 'ACTIVE';

-- ============================================================================
-- 13. NEW TABLE: property_asset — Property/asset tracking (PMLA)
-- ============================================================================
CREATE TABLE IF NOT EXISTS property_asset (
  property_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id         uuid NOT NULL REFERENCES subject_profile(subject_id) ON DELETE CASCADE,
  property_type      varchar(30) NOT NULL CHECK (property_type IN (
    'LAND','HOUSE','FLAT','COMMERCIAL','AGRICULTURAL','VEHICLE','JEWELRY','CASH','ELECTRONICS','OTHER')),
  description        text NOT NULL,
  location           text,
  estimated_value    numeric(15,2),
  ownership_type     varchar(20) CHECK (ownership_type IS NULL OR ownership_type IN (
    'SOLE','JOINT','BENAMI','SUSPECTED','FAMILY')),
  registration_details text,
  is_attached        boolean DEFAULT false,
  attachment_order_ref text,
  attached_by        text,
  attached_at        timestamptz,
  is_confiscated     boolean DEFAULT false,
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT NOW(),
  updated_at         timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_property_subject ON property_asset (subject_id);

-- ============================================================================
-- 14. NEW TABLE: location_sighting — Movement/sighting tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS location_sighting (
  sighting_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id         uuid NOT NULL REFERENCES subject_profile(subject_id) ON DELETE CASCADE,
  latitude           numeric(10,7),
  longitude          numeric(10,7),
  location_description text,
  sighting_type      varchar(30) NOT NULL CHECK (sighting_type IN (
    'CCTV','FIELD_OBSERVATION','CDR_DERIVED','INFORMANT_TIP','SOCIAL_MEDIA_CHECKIN',
    'ANPR','TOLL_PLAZA','BORDER_CROSSING','AIRPORT','RAILWAY','OTHER')),
  observed_at        timestamptz NOT NULL,
  observer_id        uuid,
  confidence         numeric(5,2),
  evidence_reference text,
  associated_vehicle_id uuid REFERENCES vehicle(vehicle_id),
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sighting_subject ON location_sighting (subject_id);
CREATE INDEX IF NOT EXISTS idx_sighting_time ON location_sighting (observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_sighting_type ON location_sighting (sighting_type);

-- ============================================================================
-- 15. NEW TABLE: upi_account + subject_upi_link
-- ============================================================================
CREATE TABLE IF NOT EXISTS upi_account (
  upi_id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vpa                varchar(100) NOT NULL UNIQUE,
  linked_bank_account_id uuid REFERENCES bank_account(account_id),
  linked_phone       varchar(30),
  provider_app       varchar(50),
  is_active          boolean DEFAULT true,
  transaction_volume integer DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subject_upi_link (
  link_id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id         uuid NOT NULL REFERENCES subject_profile(subject_id) ON DELETE CASCADE,
  upi_id             uuid NOT NULL REFERENCES upi_account(upi_id),
  relationship       varchar(20) DEFAULT 'OWNER' CHECK (relationship IN ('OWNER','SUSPECTED','RECEIVER','SENDER')),
  confidence         numeric(5,2),
  source_system      varchar(50),
  created_at         timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (subject_id, upi_id)
);

-- ============================================================================
-- 16. NEW TABLE: crypto_wallet + subject_crypto_link
-- ============================================================================
CREATE TABLE IF NOT EXISTS crypto_wallet (
  wallet_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address     text NOT NULL,
  currency           varchar(20) NOT NULL,
  wallet_type        varchar(20) CHECK (wallet_type IS NULL OR wallet_type IN ('HOT','COLD','EXCHANGE','UNKNOWN')),
  exchange_name      varchar(100),
  exchange_kyc_name  text,
  is_active          boolean DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (wallet_address, currency)
);

CREATE TABLE IF NOT EXISTS subject_crypto_link (
  link_id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id         uuid NOT NULL REFERENCES subject_profile(subject_id) ON DELETE CASCADE,
  wallet_id          uuid NOT NULL REFERENCES crypto_wallet(wallet_id),
  relationship       varchar(20) DEFAULT 'OWNER' CHECK (relationship IN ('OWNER','SUSPECTED','RECEIVER','SENDER')),
  confidence         numeric(5,2),
  source_system      varchar(50),
  created_at         timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (subject_id, wallet_id)
);

-- ============================================================================
-- 17. NEW TABLE: hawala_contact — Hawala network tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS hawala_contact (
  hawala_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id         uuid NOT NULL REFERENCES subject_profile(subject_id) ON DELETE CASCADE,
  contact_name       text NOT NULL,
  contact_phone      varchar(30),
  contact_location   text,
  hawala_route       text,
  estimated_volume   numeric(15,2),
  is_active          boolean DEFAULT true,
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hawala_subject ON hawala_contact (subject_id);

COMMIT;
