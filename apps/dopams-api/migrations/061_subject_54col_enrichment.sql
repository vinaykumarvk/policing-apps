-- Migration 061: Enrich subject_profile to BRD 54-column specification
-- Adds ~31 missing columns for case context, identity documents, financial intelligence,
-- CDR/links, offender profile, legal flags, and digital evidence references.

BEGIN;

-- === Case Context ===
ALTER TABLE subject_profile
  ADD COLUMN IF NOT EXISTS district           varchar(100),
  ADD COLUMN IF NOT EXISTS police_station     varchar(150),
  ADD COLUMN IF NOT EXISTS crime_number       varchar(50),
  ADD COLUMN IF NOT EXISTS section_of_law     text[] DEFAULT '{}';

-- === Demographics (when DOB unavailable) ===
ALTER TABLE subject_profile
  ADD COLUMN IF NOT EXISTS age integer CHECK (age IS NULL OR (age >= 0 AND age <= 120));

-- === Address (separate from JSONB addresses) ===
ALTER TABLE subject_profile
  ADD COLUMN IF NOT EXISTS residential_address       text,
  ADD COLUMN IF NOT EXISTS native_or_permanent_address text,
  ADD COLUMN IF NOT EXISTS native_state              varchar(100);

-- === Identity Documents (structured sub-schemas) ===
ALTER TABLE subject_profile
  ADD COLUMN IF NOT EXISTS ration_card_number     varchar(50),
  ADD COLUMN IF NOT EXISTS vehicle_rc_details     jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS driving_license_details jsonb,
  ADD COLUMN IF NOT EXISTS passport_details       jsonb,
  ADD COLUMN IF NOT EXISTS visa_details           jsonb;

-- === Financial Intelligence ===
ALTER TABLE subject_profile
  ADD COLUMN IF NOT EXISTS bank_account_details      jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS transaction_mode          varchar(20)
    CHECK (transaction_mode IS NULL OR transaction_mode IN ('CASH','UPI','BANK_TRANSFER','MIXED','OTHER')),
  ADD COLUMN IF NOT EXISTS bank_statement_available  boolean DEFAULT false;

-- === CDR & Links ===
ALTER TABLE subject_profile
  ADD COLUMN IF NOT EXISTS cdr_status   varchar(30) NOT NULL DEFAULT 'NOT_REQUESTED'
    CHECK (cdr_status IN ('NOT_REQUESTED','REQUESTED','RECEIVED','UNDER_ANALYSIS','COMPLETED')),
  ADD COLUMN IF NOT EXISTS cdat_links   text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS dopams_links text[] DEFAULT '{}';

-- === Offender Profile ===
ALTER TABLE subject_profile
  ADD COLUMN IF NOT EXISTS offender_status varchar(30) NOT NULL DEFAULT 'UNKNOWN'
    CHECK (offender_status IN ('UNKNOWN','SUSPECT','ACCUSED','CONVICTED','ACQUITTED','ABSCONDING','DECEASED')),
  ADD COLUMN IF NOT EXISTS offender_role          text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS drug_procurement_method text CHECK (drug_procurement_method IS NULL OR length(drug_procurement_method) <= 4000),
  ADD COLUMN IF NOT EXISTS drug_delivery_method    text CHECK (drug_delivery_method IS NULL OR length(drug_delivery_method) <= 4000);

-- === Legal Flags ===
ALTER TABLE subject_profile
  ADD COLUMN IF NOT EXISTS pd_act_details        text,
  ADD COLUMN IF NOT EXISTS history_sheet_details  text,
  ADD COLUMN IF NOT EXISTS fit_for_68f           boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS fit_for_pitndps_act   boolean DEFAULT false;

-- === Digital Evidence References ===
ALTER TABLE subject_profile
  ADD COLUMN IF NOT EXISTS whatsapp_chat_references      text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS social_media_chat_references   text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS source_document_references     text[] DEFAULT '{}';

-- === Extraction Confidence ===
ALTER TABLE subject_profile
  ADD COLUMN IF NOT EXISTS extraction_confidence_score numeric(5,4)
    CHECK (extraction_confidence_score IS NULL OR (extraction_confidence_score >= 0 AND extraction_confidence_score <= 1));

-- === Indexes for common filter/facet dimensions ===
CREATE INDEX IF NOT EXISTS idx_subject_district ON subject_profile (district);
CREATE INDEX IF NOT EXISTS idx_subject_offender_status ON subject_profile (offender_status);
CREATE INDEX IF NOT EXISTS idx_subject_cdr_status ON subject_profile (cdr_status);
CREATE INDEX IF NOT EXISTS idx_subject_police_station ON subject_profile (police_station);

COMMIT;
