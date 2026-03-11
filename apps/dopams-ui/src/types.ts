/** Shared types for the DOPAMS UI */

export type AuthHeadersFn = () => RequestInit;

export type UserAccount = {
  user_id: string;
  username: string;
  full_name: string;
  user_type: string;
  email: string;
  phone: string;
  is_active: boolean;
  roles?: string[];
};

export type AuthState = {
  user: UserAccount;
  token: string;
};

export type Alert = {
  alert_id: string;
  alert_type: string;
  severity: string;
  title: string;
  description: string;
  source_system: string;
  subject_id: string | null;
  case_id: string | null;
  state_id: string;
  assigned_to: string | null;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
  row_version: number;
  created_at: string;
  updated_at: string;
};

export type Lead = {
  lead_id: string;
  source_type: string;
  summary: string;
  details: string;
  priority: string;
  state_id: string;
  subject_id: string | null;
  assigned_to: string | null;
  created_by: string;
  row_version: number;
  created_at: string;
  updated_at: string;
};

export type DopamsCase = {
  case_id: string;
  case_number: string;
  title: string;
  description: string;
  case_type: string;
  priority: string;
  state_id: string;
  assigned_to: string | null;
  created_by: string;
  row_version: number;
  created_at: string;
  updated_at: string;
};

export type SubjectProfile = {
  subject_id: string;
  subject_ref: string;
  full_name: string;
  aliases: string[];
  date_of_birth: string | null;
  gender: string | null;
  identifiers: Record<string, string>;
  addresses: string[];
  photo_url: string | null;
  photo_urls: string[];
  risk_score: number;
  state_id: string;
  row_version: number;
  created_at: string;
  updated_at: string;

  /* Personal */
  father_name: string | null;
  mother_name: string | null;
  spouse_name: string | null;
  age: number | null;
  nationality: string | null;
  religion: string | null;
  caste: string | null;
  education: string | null;
  occupation: string | null;
  marital_status: string | null;
  known_languages: string[];

  /* Physical */
  height_cm: number | null;
  weight_kg: number | null;
  complexion: string | null;
  distinguishing_marks: string | null;
  blood_group: string | null;

  /* Extended Physical (062) */
  full_name_local: string | null;
  place_of_birth: string | null;
  build: string | null;
  eye_color: string | null;
  hair_color: string | null;
  facial_hair: string | null;
  scars: Array<{ location: string; description: string }>;
  tattoos: Array<{ location: string; description: string; photo_url?: string }>;
  handedness: string | null;
  speech_pattern: string | null;

  /* Contact */
  mobile_numbers: string[];
  email_addresses: string[];
  social_handles: Array<{ platform: string; handle: string }>;
  residential_address: string | null;
  native_or_permanent_address: string | null;
  native_state: string | null;

  /* Case Context */
  district: string | null;
  police_station: string | null;
  crime_number: string | null;
  section_of_law: string[];

  /* Identity Documents */
  ration_card_number: string | null;
  vehicle_rc_details: unknown[];
  driving_license_details: unknown | null;
  passport_details: unknown | null;
  visa_details: unknown | null;

  /* Financial */
  bank_account_details: unknown[];
  transaction_mode: string | null;
  bank_statement_available: boolean;

  /* CDR & Links */
  cdr_status: string;
  cdat_links: string[];
  dopams_links: string[];

  /* Offender Profile */
  offender_status: string;
  offender_role: string[];
  drug_procurement_method: string | null;
  drug_delivery_method: string | null;

  /* Drug Intelligence (062) */
  drug_types_dealt: string[];
  primary_drug: string | null;
  supply_chain_position: string | null;
  operational_level: string | null;
  territory_description: string | null;
  territory_districts: string[];
  territory_states: string[];
  typical_quantity: string | null;
  quantity_category: string | null;
  concealment_methods: string[];
  transport_routes: string[];
  communication_methods: string[];
  known_code_words: string[];

  /* Legal Flags */
  pd_act_details: string | null;
  history_sheet_details: string | null;
  fit_for_68f: boolean;
  fit_for_pitndps_act: boolean;

  /* Criminal History */
  criminal_history: string | null;
  ndps_history: string | null;
  first_arrested_at: string | null;
  total_arrests: number | null;
  bail_status: string | null;
  monitoring_status: string | null;
  modus_operandi: string | null;
  threat_level: string | null;

  /* Custody & Recidivism (062) */
  total_convictions: number | null;
  total_acquittals: number | null;
  last_arrested_at: string | null;
  is_recidivist: boolean;
  custody_status: string | null;
  jail_name: string | null;
  is_proclaimed_offender: boolean;
  is_habitual_offender: boolean;

  /* Digital Evidence */
  whatsapp_chat_references: string[];
  social_media_chat_references: string[];
  source_document_references: string[];

  /* Biometric & Cross-System IDs (062) */
  fingerprint_nfn: string | null;
  dna_profile_id: string | null;
  nidaan_id: string | null;
  interpol_notice_ref: string | null;
  ncb_reference: string | null;

  /* Metadata */
  extraction_confidence_score: number | null;
  field_provenance: Record<string, unknown> | null;
  is_merged: boolean;
  merged_into_id: string | null;
  source_system: string | null;
  cctns_id: string | null;
  gang_affiliation: string | null;
  known_associates: string[];
  last_seen_at: string | null;
  last_seen_location: string | null;
  completeness_score: number;
  created_by: string;
};

/* ── Enriched Entity Types (migration 062) ── */

export type PhoneDetail = {
  phone_id: string;
  raw_value: string;
  normalized_value: string;
  phone_type: string;
  relationship: string;
  confidence: number;
  imei: string | null;
  imsi: string | null;
  sim_iccid: string | null;
  is_active: boolean;
  last_active_at: string | null;
  registered_name: string | null;
  messaging_apps: string[];
};

export type AddressDetail = {
  address_id: string;
  address_type: string;
  full_address: string;
  address_line_1: string | null;
  address_line_2: string | null;
  village_town: string | null;
  city: string | null;
  tehsil: string | null;
  district: string | null;
  state: string | null;
  country: string | null;
  pin_code: string | null;
  latitude: number | null;
  longitude: number | null;
  verified_at: string | null;
  verified_by: string | null;
  confidence: number;
};

export type SocialAccountDetail = {
  account_id: string;
  platform: string;
  handle: string;
  verified: boolean;
  display_name: string | null;
  profile_photo_url: string | null;
  bio_text: string | null;
  follower_count: number | null;
  following_count: number | null;
  post_count: number | null;
  is_verified: boolean;
  is_private: boolean;
  linked_phone: string | null;
  linked_email: string | null;
  activity_status: string | null;
  last_post_at: string | null;
  flagged_content_count: number;
};

export type BankAccountDetail = {
  bank_account_id: string;
  bank_name: string;
  account_number: string;
  ifsc_code: string | null;
  branch_name: string | null;
  account_type: string | null;
  account_holder_name: string | null;
  is_joint_account: boolean;
  opening_date: string | null;
  is_frozen: boolean;
  frozen_by: string | null;
  frozen_at: string | null;
  average_monthly_balance: number | null;
  suspicious_transaction_count: number;
  statement_available: boolean;
  confidence: number;
};

export type VehicleDetail = {
  vehicle_id: string;
  registration_number: string;
  vehicle_type: string | null;
  make: string | null;
  model: string | null;
  color: string | null;
  year_of_manufacture: number | null;
  engine_number: string | null;
  chassis_number: string | null;
  fuel_type: string | null;
  registered_owner_name: string | null;
  registered_owner_address: string | null;
  insurance_policy_number: string | null;
  insurance_valid_until: string | null;
  is_stolen: boolean;
  is_under_surveillance: boolean;
  last_known_location: string | null;
  last_seen_at: string | null;
  confidence: number;
};

export type DeviceDetail = {
  device_id: string;
  device_type: string | null;
  brand: string | null;
  model: string | null;
  imei_1: string | null;
  imei_2: string | null;
  serial_number: string | null;
  operating_system: string | null;
  mac_address: string | null;
  is_encrypted: boolean;
  lock_type: string | null;
  forensic_extraction_status: string | null;
  extraction_tool: string | null;
  extraction_date: string | null;
  evidence_reference: string | null;
  confidence: number;
};

export type FamilyMember = {
  family_member_id: string;
  subject_id: string;
  relative_subject_id: string | null;
  relationship_type: string;
  full_name: string;
  contact_phone: string | null;
  contact_address: string | null;
  age: number | null;
  gender: string | null;
  occupation: string | null;
  is_aware_of_activity: boolean;
  is_involved: boolean;
  is_dependent: boolean;
  notes: string | null;
};

export type FirRecord = {
  fir_record_id: string;
  subject_id: string;
  case_id: string | null;
  fir_number: string;
  fir_date: string | null;
  police_station: string | null;
  district: string | null;
  state: string | null;
  sections_of_law: string[];
  role_in_case: string | null;
  arrest_date: string | null;
  arresting_agency: string | null;
  charge_sheet_date: string | null;
  charge_sheet_number: string | null;
  court_name: string | null;
  court_case_number: string | null;
  case_stage: string | null;
  next_hearing_date: string | null;
  verdict: string | null;
  sentence_details: string | null;
  sentence_start_date: string | null;
  sentence_end_date: string | null;
  fine_amount: number | null;
  bail_type: string | null;
  bail_date: string | null;
  bail_conditions: string | null;
  surety_details: string | null;
};

export type SeizureRecord = {
  seizure_id: string;
  subject_id: string;
  case_id: string | null;
  fir_record_id: string | null;
  seizure_date: string | null;
  seizure_location: string | null;
  seizing_officer: string | null;
  seizing_agency: string | null;
  drug_type: string | null;
  gross_weight_grams: number | null;
  net_weight_grams: number | null;
  purity_percentage: number | null;
  estimated_street_value: number | null;
  quantity_category: string | null;
  field_test_result: string | null;
  fsl_report_number: string | null;
  fsl_report_result: string | null;
  godown_deposit_date: string | null;
  godown_deposit_reference: string | null;
  panchnama_reference: string | null;
  panch_witness_names: string[];
  sealed_package_count: number | null;
  disposal_status: string | null;
};

export type WarrantRecord = {
  warrant_id: string;
  subject_id: string;
  fir_record_id: string | null;
  warrant_type: string;
  warrant_number: string;
  warrant_date: string | null;
  issuing_court: string | null;
  issuing_authority: string | null;
  is_executed: boolean;
  executed_at: string | null;
  executed_by: string | null;
  pitndps_order_number: string | null;
  pitndps_order_date: string | null;
  detention_period_days: number | null;
  status: string;
};

export type PropertyAsset = {
  property_id: string;
  subject_id: string;
  property_type: string;
  description: string | null;
  location: string | null;
  estimated_value: number | null;
  ownership_type: string | null;
  registration_details: string | null;
  is_attached: boolean;
  attachment_order_ref: string | null;
  is_confiscated: boolean;
};

export type LocationSighting = {
  sighting_id: string;
  subject_id: string;
  latitude: number | null;
  longitude: number | null;
  location_description: string | null;
  sighting_type: string;
  observed_at: string | null;
  observer_id: string | null;
  confidence: number;
  evidence_reference: string | null;
  associated_vehicle_id: string | null;
};

export type GangAssociate = {
  subject_id: string;
  full_name: string;
  aliases: string[];
  relationship_type: string;
  confidence: number;
  first_observed_at: string | null;
  last_observed_at: string | null;
  is_active: boolean;
  communication_frequency: string | null;
  notes: string | null;
};

export type UpiAccount = {
  upi_account_id: string;
  vpa: string;
  linked_bank_account_id: string | null;
  linked_phone: string | null;
  provider_app: string | null;
  is_active: boolean;
  transaction_volume: number | null;
};

export type CryptoWallet = {
  crypto_wallet_id: string;
  wallet_address: string;
  currency: string | null;
  wallet_type: string | null;
  exchange_name: string | null;
  exchange_kyc_name: string | null;
};

export type HawalaContact = {
  hawala_contact_id: string;
  subject_id: string;
  contact_name: string;
  contact_phone: string | null;
  contact_location: string | null;
  hawala_route: string | null;
  estimated_volume: number | null;
};

export type SubjectEntities = {
  phones: PhoneDetail[];
  identities: Array<{ document_pk: string; document_type: string; document_value: string; confidence: number }>;
  addresses: AddressDetail[];
  gang_associates: GangAssociate[];
  social_accounts: SocialAccountDetail[];
  bank_accounts: BankAccountDetail[];
  vehicles: VehicleDetail[];
  devices: DeviceDetail[];
  family_members: FamilyMember[];
  fir_records: FirRecord[];
  seizure_records: SeizureRecord[];
  warrant_records: WarrantRecord[];
  property_assets: PropertyAsset[];
  location_sightings: LocationSighting[];
  upi_accounts: UpiAccount[];
  crypto_wallets: CryptoWallet[];
  hawala_contacts: HawalaContact[];
};

export type Task = {
  task_id: string;
  entity_type: string;
  entity_id: string;
  state_id: string;
  role_id: string;
  status: string;
  decision: string | null;
  remarks: string | null;
  assignee_user_id: string | null;
  sla_due_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3011";
