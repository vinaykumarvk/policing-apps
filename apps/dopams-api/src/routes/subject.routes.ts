import { FastifyInstance } from "fastify";
import { query } from "../db";
import { send400, send404, sendError } from "../errors";
import { executeTransition } from "../workflow-bridge";
import { getAvailableTransitions } from "../workflow-bridge/transitions";
import { createRoleGuard } from "@puda/api-core";
import { upsertPhone, upsertIdentityDoc, linkPhoneToSubject, linkIdentityToSubject } from "../services/entity-normalizer";
import { insertAssertion } from "../services/assertion-engine";

const PRIVILEGED_ROLES = ["ADMINISTRATOR", "PLATFORM_ADMINISTRATOR", "INTELLIGENCE_ANALYST", "INVESTIGATING_OFFICER"];

const PII_FIELDS = [
  "identifiers", "addresses", "bank_account_details",
  "passport_details", "visa_details", "driving_license_details",
  "fingerprint_nfn", "dna_profile_id", "ration_card_number",
];

function maskSubjectPII(row: Record<string, unknown>, userRoles: string[]): Record<string, unknown> {
  if (!userRoles.some((r) => PRIVILEGED_ROLES.includes(r))) {
    for (const f of PII_FIELDS) {
      if (row[f]) row[f] = "[REDACTED]";
    }
  }
  return row;
}

// All 54-column SELECT used for GET /:id
const SUBJECT_SELECT = `
  subject_id, subject_ref, full_name, aliases, date_of_birth, gender, identifiers, addresses,
  photo_url, risk_score, father_name, mother_name, spouse_name, height_cm, weight_kg,
  complexion, distinguishing_marks, blood_group, nationality, religion, caste,
  education, occupation, marital_status, known_languages, mobile_numbers, email_addresses,
  social_handles, criminal_history, ndps_history, first_arrested_at, total_arrests,
  bail_status, monitoring_status, last_seen_at, last_seen_location, known_associates,
  gang_affiliation, modus_operandi, threat_level, field_provenance, photo_urls,
  is_merged, merged_into_id, source_system, cctns_id,
  district, police_station, crime_number, section_of_law, age,
  residential_address, native_or_permanent_address, native_state,
  ration_card_number, vehicle_rc_details, driving_license_details, passport_details, visa_details,
  bank_account_details, transaction_mode, bank_statement_available,
  cdr_status, cdat_links, dopams_links,
  offender_status, offender_role, drug_procurement_method, drug_delivery_method,
  pd_act_details, history_sheet_details, fit_for_68f, fit_for_pitndps_act,
  whatsapp_chat_references, social_media_chat_references, source_document_references,
  extraction_confidence_score,
  full_name_local, place_of_birth, build, eye_color, hair_color, facial_hair,
  scars, tattoos, handedness, speech_pattern,
  fingerprint_nfn, dna_profile_id, nidaan_id, interpol_notice_ref, ncb_reference,
  drug_types_dealt, primary_drug, supply_chain_position, operational_level,
  territory_description, territory_districts, territory_states,
  typical_quantity, quantity_category, concealment_methods, transport_routes,
  communication_methods, known_code_words,
  total_convictions, total_acquittals, last_arrested_at, is_recidivist,
  custody_status, jail_name, is_proclaimed_offender, is_habitual_offender,
  state_id, row_version, created_by, created_at, updated_at
`;

// Completeness score fields (FR-04 AC-04) — expanded for 54-col BRD
const PROFILE_FIELDS = [
  'full_name', 'date_of_birth', 'gender', 'father_name', 'nationality',
  'identifiers', 'addresses', 'mobile_numbers', 'photo_url', 'occupation',
  'criminal_history', 'height_cm', 'complexion', 'distinguishing_marks',
  'known_languages', 'blood_group', 'district', 'offender_status',
  'cdr_status', 'source_document_references', 'extraction_confidence_score',
];

function computeCompleteness(row: Record<string, unknown>): number {
  const filled = PROFILE_FIELDS.filter(f => {
    const val = row[f];
    if (val === null || val === undefined) return false;
    if (Array.isArray(val)) return val.length > 0;
    if (typeof val === 'object') return Object.keys(val).length > 0;
    return String(val).trim().length > 0;
  }).length;
  return Math.round((filled / PROFILE_FIELDS.length) * 100);
}

// New fields added in migration 061
const NEW_BODY_PROPS = {
  district: { type: "string", maxLength: 100 },
  policeStation: { type: "string", maxLength: 150 },
  crimeNumber: { type: "string", maxLength: 50 },
  sectionOfLaw: { type: "array", items: { type: "string" } },
  age: { type: "integer", minimum: 0, maximum: 120 },
  residentialAddress: { type: "string" },
  nativeOrPermanentAddress: { type: "string" },
  nativeState: { type: "string", maxLength: 100 },
  rationCardNumber: { type: "string", maxLength: 50 },
  vehicleRcDetails: { type: "array", items: { type: "object", additionalProperties: true } },
  drivingLicenseDetails: { type: "object", additionalProperties: true },
  passportDetails: { type: "object", additionalProperties: true },
  visaDetails: { type: "object", additionalProperties: true },
  bankAccountDetails: { type: "array", items: { type: "object", additionalProperties: true } },
  transactionMode: { type: "string", enum: ["CASH", "UPI", "BANK_TRANSFER", "MIXED", "OTHER"] },
  bankStatementAvailable: { type: "boolean" },
  cdrStatus: { type: "string", enum: ["NOT_REQUESTED", "REQUESTED", "RECEIVED", "UNDER_ANALYSIS", "COMPLETED"] },
  cdatLinks: { type: "array", items: { type: "string" } },
  dopamsLinks: { type: "array", items: { type: "string" } },
  offenderStatus: { type: "string", enum: ["UNKNOWN", "SUSPECT", "ACCUSED", "CONVICTED", "ACQUITTED", "ABSCONDING", "DECEASED"] },
  offenderRole: { type: "array", items: { type: "string" } },
  drugProcurementMethod: { type: "string", maxLength: 4000 },
  drugDeliveryMethod: { type: "string", maxLength: 4000 },
  pdActDetails: { type: "string" },
  historySheetDetails: { type: "string" },
  fitFor68f: { type: "boolean" },
  fitForPitndpsAct: { type: "boolean" },
  whatsappChatReferences: { type: "array", items: { type: "string" } },
  socialMediaChatReferences: { type: "array", items: { type: "string" } },
  sourceDocumentReferences: { type: "array", items: { type: "string" } },
  extractionConfidenceScore: { type: "number", minimum: 0, maximum: 1 },
  /* 062 — extended physical */
  fullNameLocal: { type: "string" },
  placeOfBirth: { type: "string" },
  build: { type: "string", enum: ["SLIM", "MEDIUM", "HEAVY", "MUSCULAR", "OBESE"] },
  eyeColor: { type: "string" },
  hairColor: { type: "string" },
  facialHair: { type: "string" },
  scars: { type: "array", items: { type: "object", additionalProperties: true } },
  tattoos: { type: "array", items: { type: "object", additionalProperties: true } },
  handedness: { type: "string", enum: ["LEFT", "RIGHT", "AMBIDEXTROUS"] },
  speechPattern: { type: "string" },
  /* 062 — biometric / cross-system */
  fingerprintNfn: { type: "string" },
  dnaProfileId: { type: "string" },
  nidaanId: { type: "string" },
  interpolNoticeRef: { type: "string" },
  ncbReference: { type: "string" },
  /* 062 — drug intelligence */
  drugTypesDealt: { type: "array", items: { type: "string" } },
  primaryDrug: { type: "string" },
  supplyChainPosition: { type: "string", enum: ["PRODUCER", "MANUFACTURER", "TRANSPORTER", "DISTRIBUTOR", "RETAILER", "FINANCIER", "FACILITATOR"] },
  operationalLevel: { type: "string", enum: ["STREET", "MID_LEVEL", "KINGPIN", "INTERNATIONAL"] },
  territoryDescription: { type: "string" },
  territoryDistricts: { type: "array", items: { type: "string" } },
  territoryStates: { type: "array", items: { type: "string" } },
  typicalQuantity: { type: "string" },
  quantityCategory: { type: "string", enum: ["SMALL", "COMMERCIAL", "INTERMEDIATE", "LARGE_COMMERCIAL"] },
  concealmentMethods: { type: "array", items: { type: "string" } },
  transportRoutes: { type: "array", items: { type: "string" } },
  communicationMethods: { type: "array", items: { type: "string" } },
  knownCodeWords: { type: "array", items: { type: "string" } },
  /* 062 — custody / recidivism */
  totalConvictions: { type: "integer" },
  totalAcquittals: { type: "integer" },
  lastArrestedAt: { type: "string", format: "date" },
  isRecidivist: { type: "boolean" },
  custodyStatus: { type: "string", enum: ["FREE", "IN_CUSTODY", "ON_BAIL", "ON_PAROLE", "ABSCONDING", "DECEASED"] },
  jailName: { type: "string" },
  isProclaimedOffender: { type: "boolean" },
  isHabitualOffender: { type: "boolean" },
} as const;

// camelCase → snake_case for new fields
const NEW_FIELD_MAP: Record<string, string> = {
  district: "district", policeStation: "police_station", crimeNumber: "crime_number",
  sectionOfLaw: "section_of_law", age: "age",
  residentialAddress: "residential_address", nativeOrPermanentAddress: "native_or_permanent_address",
  nativeState: "native_state", rationCardNumber: "ration_card_number",
  vehicleRcDetails: "vehicle_rc_details", drivingLicenseDetails: "driving_license_details",
  passportDetails: "passport_details", visaDetails: "visa_details",
  bankAccountDetails: "bank_account_details", transactionMode: "transaction_mode",
  bankStatementAvailable: "bank_statement_available",
  cdrStatus: "cdr_status", cdatLinks: "cdat_links", dopamsLinks: "dopams_links",
  offenderStatus: "offender_status", offenderRole: "offender_role",
  drugProcurementMethod: "drug_procurement_method", drugDeliveryMethod: "drug_delivery_method",
  pdActDetails: "pd_act_details", historySheetDetails: "history_sheet_details",
  fitFor68f: "fit_for_68f", fitForPitndpsAct: "fit_for_pitndps_act",
  whatsappChatReferences: "whatsapp_chat_references",
  socialMediaChatReferences: "social_media_chat_references",
  sourceDocumentReferences: "source_document_references",
  extractionConfidenceScore: "extraction_confidence_score",
  /* 062 — extended physical */
  fullNameLocal: "full_name_local", placeOfBirth: "place_of_birth",
  build: "build", eyeColor: "eye_color", hairColor: "hair_color",
  facialHair: "facial_hair", scars: "scars", tattoos: "tattoos",
  handedness: "handedness", speechPattern: "speech_pattern",
  /* 062 — biometric / cross-system */
  fingerprintNfn: "fingerprint_nfn", dnaProfileId: "dna_profile_id",
  nidaanId: "nidaan_id", interpolNoticeRef: "interpol_notice_ref", ncbReference: "ncb_reference",
  /* 062 — drug intelligence */
  drugTypesDealt: "drug_types_dealt", primaryDrug: "primary_drug",
  supplyChainPosition: "supply_chain_position", operationalLevel: "operational_level",
  territoryDescription: "territory_description", territoryDistricts: "territory_districts",
  territoryStates: "territory_states", typicalQuantity: "typical_quantity",
  quantityCategory: "quantity_category", concealmentMethods: "concealment_methods",
  transportRoutes: "transport_routes", communicationMethods: "communication_methods",
  knownCodeWords: "known_code_words",
  /* 062 — custody / recidivism */
  totalConvictions: "total_convictions", totalAcquittals: "total_acquittals",
  lastArrestedAt: "last_arrested_at", isRecidivist: "is_recidivist",
  custodyStatus: "custody_status", jailName: "jail_name",
  isProclaimedOffender: "is_proclaimed_offender", isHabitualOffender: "is_habitual_offender",
};

// Fields that are JSON-stringified before INSERT/UPDATE
const JSON_FIELDS = new Set([
  "aliases", "knownLanguages", "mobileNumbers", "socialHandles", "fieldProvenance",
  "vehicleRcDetails", "drivingLicenseDetails", "passportDetails", "visaDetails", "bankAccountDetails",
  "scars", "tattoos",
]);

// Fields that are text[] arrays — use $N::text[] casting
const ARRAY_FIELDS = new Set([
  "sectionOfLaw", "cdatLinks", "dopamsLinks", "offenderRole",
  "whatsappChatReferences", "socialMediaChatReferences", "sourceDocumentReferences",
  "drugTypesDealt", "territoryDistricts", "territoryStates",
  "concealmentMethods", "transportRoutes", "communicationMethods", "knownCodeWords",
]);

export async function registerSubjectRoutes(app: FastifyInstance): Promise<void> {
  const requireSubjectWrite = createRoleGuard(["INTELLIGENCE_ANALYST", "SUPERVISORY_OFFICER", "ADMINISTRATOR"]);

  // ---------- LIST ----------
  app.get("/api/v1/subjects", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          state_id: { type: "string", maxLength: 100 },
          gender: { type: "string", maxLength: 50 },
          offender_status: { type: "string", maxLength: 50 },
          cdr_status: { type: "string", maxLength: 50 },
          threat_level: { type: "string", maxLength: 50 },
          district: { type: "string", maxLength: 100 },
          limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
          offset: { type: "integer", minimum: 0, default: 0 },
        },
      },
    },
  }, async (request) => {
    const q = request.query as Record<string, string | undefined>;
    const roles = request.authUser?.roles || [];
    const isPrivileged = roles.some((r: string) => PRIVILEGED_ROLES.includes(r));
    const unitId = isPrivileged ? null : (request.authUser?.unitId || null);
    const limit = Math.min(Math.max(parseInt(q.limit || "50", 10) || 50, 1), 200);
    const offset = Math.max(parseInt(q.offset || "0", 10) || 0, 0);

    const result = await query(
      `SELECT subject_id, subject_ref, full_name, aliases, date_of_birth, gender, risk_score,
              monitoring_status, threat_level, bail_status, is_merged,
              offender_status, cdr_status, district,
              state_id, created_by, created_at,
              COUNT(*) OVER() AS total_count
       FROM subject_profile
       WHERE ($1::text IS NULL OR state_id = $1)
         AND ($2::text IS NULL OR gender = $2)
         AND ($3::uuid IS NULL OR unit_id = $3::uuid)
         AND ($6::text IS NULL OR offender_status = $6)
         AND ($7::text IS NULL OR cdr_status = $7)
         AND ($8::text IS NULL OR threat_level = $8)
         AND ($9::text IS NULL OR district = $9)
       ORDER BY created_at DESC
       LIMIT $4 OFFSET $5`,
      [
        q.state_id || null, q.gender || null, unitId, limit, offset,
        q.offender_status || null, q.cdr_status || null,
        q.threat_level || null, q.district || null,
      ],
    );
    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
    return { subjects: result.rows.map(({ total_count, ...r }) => r), total };
  });

  // ---------- FACETS ----------
  app.get("/api/v1/subjects/facets", async (request) => {
    const roles = request.authUser?.roles || [];
    const isPrivileged = roles.some((r: string) => PRIVILEGED_ROLES.includes(r));
    const unitId = isPrivileged ? null : (request.authUser?.unitId || null);
    const [stateRows, genderRows, offenderRows, cdrRows, threatRows, districtRows] = await Promise.all([
      query(`SELECT state_id AS value, COUNT(*)::int AS count FROM subject_profile WHERE ($1::uuid IS NULL OR unit_id = $1::uuid) GROUP BY state_id ORDER BY count DESC`, [unitId]),
      query(`SELECT gender AS value, COUNT(*)::int AS count FROM subject_profile WHERE ($1::uuid IS NULL OR unit_id = $1::uuid) GROUP BY gender ORDER BY count DESC`, [unitId]),
      query(`SELECT offender_status AS value, COUNT(*)::int AS count FROM subject_profile WHERE ($1::uuid IS NULL OR unit_id = $1::uuid) GROUP BY offender_status ORDER BY count DESC`, [unitId]),
      query(`SELECT cdr_status AS value, COUNT(*)::int AS count FROM subject_profile WHERE ($1::uuid IS NULL OR unit_id = $1::uuid) GROUP BY cdr_status ORDER BY count DESC`, [unitId]),
      query(`SELECT threat_level AS value, COUNT(*)::int AS count FROM subject_profile WHERE ($1::uuid IS NULL OR unit_id = $1::uuid) GROUP BY threat_level ORDER BY count DESC`, [unitId]),
      query(`SELECT district AS value, COUNT(*)::int AS count FROM subject_profile WHERE ($1::uuid IS NULL OR unit_id = $1::uuid) AND district IS NOT NULL GROUP BY district ORDER BY count DESC`, [unitId]),
    ]);
    return {
      facets: {
        state_id: stateRows.rows,
        gender: genderRows.rows,
        offender_status: offenderRows.rows,
        cdr_status: cdrRows.rows,
        threat_level: threatRows.rows,
        district: districtRows.rows,
      },
    };
  });

  // ---------- GET ONE ----------
  app.get("/api/v1/subjects/:id", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          include: { type: "string", maxLength: 200 },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const roles = request.authUser?.roles || [];
    const isPrivileged = roles.some((r: string) => PRIVILEGED_ROLES.includes(r));
    const unitId = isPrivileged ? null : (request.authUser?.unitId || null);
    const result = await query(
      `SELECT ${SUBJECT_SELECT} FROM subject_profile WHERE subject_id = $1 AND ($2::uuid IS NULL OR unit_id = $2::uuid)`,
      [id, unitId],
    );
    if (result.rows.length === 0) {
      return send404(reply, "SUBJECT_NOT_FOUND", "Subject not found");
    }
    const subject = maskSubjectPII(result.rows[0], request.authUser?.roles ?? []);
    subject.completeness_score = computeCompleteness(result.rows[0]);

    // Optional includes: ?include=entities,assertions
    const includeParam = ((request.query as Record<string, string | undefined>).include || "").split(",").map((s: string) => s.trim()).filter(Boolean);
    const response: Record<string, unknown> = { subject };

    if (includeParam.includes("entities")) {
      const [
        phones, identities, gangAssociates, socialAccounts,
        addresses, bankAccounts, vehicles, devices,
        familyMembers, firRecords, seizureRecords, warrantRecords,
        propertyAssets, locationSightings, upiAccounts, cryptoWallets, hawalaContacts,
      ] = await Promise.all([
        query(
          `SELECT pn.phone_id, pn.raw_value, pn.normalized_value, pn.phone_type,
                  pn.imei, pn.imsi, pn.sim_iccid, pn.is_active, pn.last_active_at,
                  pn.registered_name, pn.messaging_apps,
                  spl.relationship, spl.confidence
           FROM subject_phone_link spl JOIN phone_number pn ON pn.phone_id = spl.phone_id
           WHERE spl.subject_id = $1`, [id],
        ),
        query(
          `SELECT id.document_pk, id.document_type, id.document_value, sil.confidence
           FROM subject_identity_link sil JOIN identity_document id ON id.document_pk = sil.document_pk
           WHERE sil.subject_id = $1`, [id],
        ),
        query(
          `SELECT sp.subject_id, sp.full_name, sp.aliases,
                  ssl.relationship AS relationship_type, ssl.strength AS confidence,
                  ssl.first_observed_at, ssl.last_observed_at, ssl.is_active,
                  ssl.communication_frequency, ssl.notes
           FROM subject_subject_link ssl
           JOIN subject_profile sp
             ON sp.subject_id = CASE WHEN ssl.subject_id_a = $1 THEN ssl.subject_id_b ELSE ssl.subject_id_a END
           WHERE ssl.subject_id_a = $1 OR ssl.subject_id_b = $1
           ORDER BY ssl.created_at
           LIMIT 11`, [id],
        ),
        query(
          `SELECT sa.social_id AS account_id, sa.platform, sa.handle,
                  sa.display_name, sa.profile_photo_url, sa.bio_text,
                  sa.follower_count, sa.following_count, sa.post_count,
                  sa.is_verified, sa.is_private, sa.linked_phone, sa.linked_email,
                  sa.activity_status, sa.last_post_at, sa.flagged_content_count
           FROM subject_social_link ssl
           JOIN social_account sa ON sa.social_id = ssl.social_id
           WHERE ssl.subject_id = $1`, [id],
        ),
        query(
          `SELECT a.address_id, a.address_type, a.raw_address AS full_address,
                  a.address_line_1, a.address_line_2, a.village_town,
                  a.tehsil, a.district, a.state, a.country, a.pincode AS pin_code,
                  a.latitude, a.longitude, a.verified_at, a.verified_by,
                  100 AS confidence
           FROM subject_address_link sal JOIN address a ON a.address_id = sal.address_id
           WHERE sal.subject_id = $1`, [id],
        ),
        query(
          `SELECT ba.account_id AS bank_account_id, ba.bank_name, ba.account_number, ba.ifsc_code,
                  ba.branch_name, ba.account_type, ba.account_holder_name,
                  ba.is_joint_account, ba.opening_date, ba.is_frozen, ba.frozen_by, ba.frozen_at,
                  ba.average_monthly_balance, ba.suspicious_transaction_count, ba.statement_available,
                  sal.confidence
           FROM subject_account_link sal JOIN bank_account ba ON ba.account_id = sal.account_id
           WHERE sal.subject_id = $1`, [id],
        ),
        query(
          `SELECT v.vehicle_id, v.registration_no AS registration_number, v.vehicle_type,
                  v.make, v.model, v.color,
                  v.year_of_manufacture, v.engine_number, v.chassis_number, v.fuel_type,
                  v.registered_owner_name, v.registered_owner_address,
                  v.insurance_policy_number, v.insurance_valid_until,
                  v.is_stolen, v.is_under_surveillance, v.last_known_location, v.last_seen_at,
                  svl.confidence
           FROM subject_vehicle_link svl JOIN vehicle v ON v.vehicle_id = svl.vehicle_id
           WHERE svl.subject_id = $1`, [id],
        ),
        query(
          `SELECT d.device_id, d.device_type, d.manufacturer AS brand,
                  d.device_model AS model,
                  d.imei AS imei_1, d.imei_2, d.serial_number, d.operating_system, d.mac_address,
                  d.is_encrypted, d.lock_type, d.forensic_extraction_status,
                  d.extraction_tool, d.extraction_date, d.evidence_reference,
                  sdl.confidence
           FROM subject_device_link sdl JOIN device d ON d.device_id = sdl.device_id
           WHERE sdl.subject_id = $1`, [id],
        ),
        query(
          `SELECT family_member_id, subject_id, relative_subject_id, relationship_type,
                  full_name, contact_phone, contact_address, age, gender, occupation,
                  is_aware_of_activity, is_involved, is_dependent, notes
           FROM subject_family_member WHERE subject_id = $1
           ORDER BY relationship_type`, [id],
        ),
        query(
          `SELECT fir_record_id, subject_id, case_id, fir_number, fir_date,
                  police_station, district, state, sections_of_law, role_in_case,
                  arrest_date, arresting_agency, charge_sheet_date, charge_sheet_number,
                  court_name, court_case_number, case_stage, next_hearing_date,
                  verdict, sentence_details, sentence_start_date, sentence_end_date,
                  fine_amount, bail_type, bail_date, bail_conditions, surety_details
           FROM fir_record WHERE subject_id = $1
           ORDER BY fir_date DESC`, [id],
        ),
        query(
          `SELECT seizure_id, subject_id, case_id, fir_record_id, seizure_date,
                  seizure_location, seizing_officer, seizing_agency, drug_type,
                  gross_weight_grams, net_weight_grams, purity_percentage,
                  estimated_street_value, quantity_category, field_test_result,
                  fsl_report_number, fsl_result AS fsl_report_result, godown_deposit_date,
                  godown_reference AS godown_deposit_reference, panchnama_reference, panch_witness_names,
                  sealed_package_count, disposal_status
           FROM seizure_record WHERE subject_id = $1
           ORDER BY seizure_date DESC`, [id],
        ),
        query(
          `SELECT warrant_id, subject_id, fir_record_id, warrant_type, warrant_number,
                  warrant_date, issuing_court, issuing_authority, is_executed,
                  executed_at, executed_by, pitndps_order_number, pitndps_order_date,
                  detention_period_days, status
           FROM warrant_record WHERE subject_id = $1
           ORDER BY warrant_date DESC`, [id],
        ),
        query(
          `SELECT property_id, subject_id, property_type, description, location,
                  estimated_value, ownership_type, registration_details,
                  is_attached, attachment_order_ref, is_confiscated
           FROM property_asset WHERE subject_id = $1`, [id],
        ),
        query(
          `SELECT sighting_id, subject_id, latitude, longitude, location_description,
                  sighting_type, observed_at, observer_id, confidence,
                  evidence_reference, associated_vehicle_id
           FROM location_sighting WHERE subject_id = $1
           ORDER BY observed_at DESC LIMIT 50`, [id],
        ),
        query(
          `SELECT ua.upi_id AS upi_account_id, ua.vpa, ua.linked_bank_account_id,
                  ua.linked_phone, ua.provider_app, ua.is_active, ua.transaction_volume
           FROM subject_upi_link sul JOIN upi_account ua ON ua.upi_id = sul.upi_id
           WHERE sul.subject_id = $1`, [id],
        ),
        query(
          `SELECT cw.wallet_id AS crypto_wallet_id, cw.wallet_address, cw.currency,
                  cw.wallet_type, cw.exchange_name, cw.exchange_kyc_name
           FROM subject_crypto_link scl JOIN crypto_wallet cw ON cw.wallet_id = scl.wallet_id
           WHERE scl.subject_id = $1`, [id],
        ),
        query(
          `SELECT hawala_id AS hawala_contact_id, subject_id, contact_name, contact_phone,
                  contact_location, hawala_route, estimated_volume
           FROM hawala_contact WHERE subject_id = $1`, [id],
        ),
      ]);
      response.entities = {
        phones: phones.rows,
        identities: identities.rows,
        addresses: addresses.rows,
        gang_associates: gangAssociates.rows,
        social_accounts: socialAccounts.rows,
        bank_accounts: bankAccounts.rows,
        vehicles: vehicles.rows,
        devices: devices.rows,
        family_members: familyMembers.rows,
        fir_records: firRecords.rows,
        seizure_records: seizureRecords.rows,
        warrant_records: warrantRecords.rows,
        property_assets: propertyAssets.rows,
        location_sightings: locationSightings.rows,
        upi_accounts: upiAccounts.rows,
        crypto_wallets: cryptoWallets.rows,
        hawala_contacts: hawalaContacts.rows,
      };
    }

    if (includeParam.includes("assertions")) {
      const { getAssertions } = await import("../services/assertion-engine");
      const { assertions, total } = await getAssertions(id, { currentOnly: true, limit: 100 });
      response.assertions = { items: assertions, total };
    }

    return response;
  });

  // ---------- CREATE ----------
  app.post("/api/v1/subjects", {
    schema: { body: { type: "object", additionalProperties: false, required: ["fullName"], properties: {
      fullName: { type: "string" }, aliases: { type: "array", items: { type: "string" } }, identifiers: { type: "object", additionalProperties: true },
      fatherName: { type: "string" }, motherName: { type: "string" }, spouseName: { type: "string" },
      dateOfBirth: { type: "string", format: "date" }, gender: { type: "string" },
      heightCm: { type: "number" }, weightKg: { type: "number" }, complexion: { type: "string" },
      distinguishingMarks: { type: "string" }, bloodGroup: { type: "string" },
      nationality: { type: "string" }, religion: { type: "string" }, caste: { type: "string" },
      education: { type: "string" }, occupation: { type: "string" }, maritalStatus: { type: "string" },
      knownLanguages: { type: "array", items: { type: "string" } },
      mobileNumbers: { type: "array", items: { type: "string" } },
      emailAddresses: { type: "array", items: { type: "string" } },
      socialHandles: { type: "array", items: { type: "object", additionalProperties: true } },
      monitoringStatus: { type: "string", enum: ["NONE", "ACTIVE", "WATCH", "SURVEILLANCE"] },
      threatLevel: { type: "string", enum: ["UNKNOWN", "LOW", "MEDIUM", "HIGH", "CRITICAL"] },
      sourceSystem: { type: "string" }, cctnsId: { type: "string" },
      ...NEW_BODY_PROPS,
    } } },
  }, async (request, reply) => {
    if (!requireSubjectWrite(request, reply)) return;
    const body = request.body as Record<string, unknown>;
    const { fullName, aliases, identifiers } = body as { fullName: string; aliases?: string[]; identifiers?: Record<string, unknown> };
    const { userId } = request.authUser!;
    const unitId = request.authUser?.unitId || null;
    const refResult = await query(`SELECT 'DOP-SUBJ-' || EXTRACT(YEAR FROM NOW())::text || '-' || LPAD(nextval('dopams_subject_ref_seq')::text, 6, '0') AS ref`);
    const subjectRef = refResult.rows[0].ref;

    const result = await query(
      `INSERT INTO subject_profile (
        subject_ref, full_name, aliases, identifiers, created_by, unit_id,
        father_name, mother_name, spouse_name, date_of_birth, gender, height_cm, weight_kg,
        complexion, distinguishing_marks, blood_group, nationality, religion, caste,
        education, occupation, marital_status, known_languages, mobile_numbers, email_addresses,
        social_handles, monitoring_status, threat_level, source_system, cctns_id,
        district, police_station, crime_number, section_of_law, age,
        residential_address, native_or_permanent_address, native_state,
        ration_card_number, vehicle_rc_details, driving_license_details, passport_details, visa_details,
        bank_account_details, transaction_mode, bank_statement_available,
        cdr_status, cdat_links, dopams_links,
        offender_status, offender_role, drug_procurement_method, drug_delivery_method,
        pd_act_details, history_sheet_details, fit_for_68f, fit_for_pitndps_act,
        whatsapp_chat_references, social_media_chat_references, source_document_references,
        extraction_confidence_score,
        full_name_local, place_of_birth, build, eye_color, hair_color, facial_hair,
        scars, tattoos, handedness, speech_pattern,
        fingerprint_nfn, dna_profile_id, nidaan_id, interpol_notice_ref, ncb_reference,
        drug_types_dealt, primary_drug, supply_chain_position, operational_level,
        territory_description, territory_districts, territory_states,
        typical_quantity, quantity_category, concealment_methods, transport_routes,
        communication_methods, known_code_words,
        total_convictions, total_acquittals, last_arrested_at, is_recidivist,
        custody_status, jail_name, is_proclaimed_offender, is_habitual_offender)
       VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18, $19,
        $20, $21, $22, $23, $24, $25,
        $26, $27, $28, $29, $30,
        $31, $32, $33, $34::text[], $35,
        $36, $37, $38,
        $39, $40, $41, $42, $43,
        $44, $45, $46,
        $47, $48::text[], $49::text[],
        $50, $51::text[], $52, $53,
        $54, $55, $56, $57,
        $58::text[], $59::text[], $60::text[],
        $61,
        $62, $63, $64, $65, $66, $67,
        $68, $69, $70, $71,
        $72, $73, $74, $75, $76,
        $77::text[], $78, $79, $80,
        $81, $82::text[], $83::text[],
        $84, $85, $86::text[], $87::text[],
        $88::text[], $89::text[],
        $90, $91, $92, $93,
        $94, $95, $96, $97)
       RETURNING subject_id, subject_ref, full_name, aliases, identifiers, state_id, unit_id, created_by, created_at`,
      [
        subjectRef, fullName, JSON.stringify(aliases || []), JSON.stringify(identifiers || {}), userId, unitId,
        body.fatherName || null, body.motherName || null, body.spouseName || null,
        body.dateOfBirth || null, body.gender || null, body.heightCm || null, body.weightKg || null,
        body.complexion || null, body.distinguishingMarks || null, body.bloodGroup || null,
        body.nationality || null, body.religion || null, body.caste || null,
        body.education || null, body.occupation || null, body.maritalStatus || null,
        JSON.stringify(body.knownLanguages || []), JSON.stringify(body.mobileNumbers || []),
        JSON.stringify(body.emailAddresses || []),
        JSON.stringify(body.socialHandles || []),
        body.monitoringStatus || "NONE", body.threatLevel || "UNKNOWN",
        body.sourceSystem || null, body.cctnsId || null,
        /* 061 new columns */
        body.district || null, body.policeStation || null, body.crimeNumber || null,
        body.sectionOfLaw || [], body.age || null,
        body.residentialAddress || null, body.nativeOrPermanentAddress || null, body.nativeState || null,
        body.rationCardNumber || null,
        JSON.stringify(body.vehicleRcDetails || []),
        body.drivingLicenseDetails ? JSON.stringify(body.drivingLicenseDetails) : null,
        body.passportDetails ? JSON.stringify(body.passportDetails) : null,
        body.visaDetails ? JSON.stringify(body.visaDetails) : null,
        JSON.stringify(body.bankAccountDetails || []),
        body.transactionMode || null, body.bankStatementAvailable ?? false,
        body.cdrStatus || "NOT_REQUESTED",
        body.cdatLinks || [], body.dopamsLinks || [],
        body.offenderStatus || "UNKNOWN",
        body.offenderRole || [],
        body.drugProcurementMethod || null, body.drugDeliveryMethod || null,
        body.pdActDetails || null, body.historySheetDetails || null,
        body.fitFor68f ?? false, body.fitForPitndpsAct ?? false,
        body.whatsappChatReferences || [], body.socialMediaChatReferences || [],
        body.sourceDocumentReferences || [],
        body.extractionConfidenceScore ?? null,
        /* 062 new columns */
        body.fullNameLocal || null, body.placeOfBirth || null,
        body.build || null, body.eyeColor || null, body.hairColor || null, body.facialHair || null,
        body.scars ? JSON.stringify(body.scars) : '[]',
        body.tattoos ? JSON.stringify(body.tattoos) : '[]',
        body.handedness || null, body.speechPattern || null,
        body.fingerprintNfn || null, body.dnaProfileId || null,
        body.nidaanId || null, body.interpolNoticeRef || null, body.ncbReference || null,
        body.drugTypesDealt || [], body.primaryDrug || null,
        body.supplyChainPosition || null, body.operationalLevel || null,
        body.territoryDescription || null, body.territoryDistricts || [], body.territoryStates || [],
        body.typicalQuantity || null, body.quantityCategory || null,
        body.concealmentMethods || [], body.transportRoutes || [],
        body.communicationMethods || [], body.knownCodeWords || [],
        body.totalConvictions ?? null, body.totalAcquittals ?? null,
        body.lastArrestedAt || null, body.isRecidivist ?? false,
        body.custodyStatus || null, body.jailName || null,
        body.isProclaimedOffender ?? false, body.isHabitualOffender ?? false,
      ],
    );
    const newSubjectId = result.rows[0].subject_id as string;
    const sourceSystem = (body.sourceSystem as string) || "MANUAL";

    // Dual-write: normalize phone numbers into entity tables
    const mobileNumbers = (body.mobileNumbers as string[]) || [];
    for (const num of mobileNumbers) {
      try {
        const phoneId = await upsertPhone(num);
        await linkPhoneToSubject(newSubjectId, phoneId, "OWNER", sourceSystem);
      } catch { /* best-effort — JSONB is source of truth */ }
    }

    // Dual-write: normalize identity documents into entity tables
    const identityFields: Array<{ field: string; docType: string }> = [
      { field: "aadhaarHash", docType: "AADHAAR" },
      { field: "panNumber", docType: "PAN" },
      { field: "passportNumber", docType: "PASSPORT" },
      { field: "drivingLicense", docType: "DRIVING_LICENSE" },
      { field: "voterId", docType: "VOTER_ID" },
    ];
    const idDocs = (body.identifiers as Record<string, string> | undefined) || {};
    for (const { field, docType } of identityFields) {
      const val = idDocs[field] || (body as Record<string, unknown>)[field];
      if (val && typeof val === "string" && val.trim()) {
        try {
          const docPk = await upsertIdentityDoc(docType, val);
          await linkIdentityToSubject(newSubjectId, docPk, sourceSystem);
        } catch { /* best-effort */ }
      }
    }

    reply.code(201);
    return { subject: maskSubjectPII(result.rows[0], request.authUser?.roles ?? []) };
  });

  // ---------- UPDATE ----------
  app.put("/api/v1/subjects/:id", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: { type: "object", additionalProperties: false, properties: {
        fullName: { type: "string" }, aliases: { type: "array", items: { type: "string" } },
        fatherName: { type: "string" }, motherName: { type: "string" }, spouseName: { type: "string" },
        dateOfBirth: { type: "string", format: "date" }, gender: { type: "string" },
        heightCm: { type: "number" }, weightKg: { type: "number" }, complexion: { type: "string" },
        distinguishingMarks: { type: "string" }, bloodGroup: { type: "string" },
        nationality: { type: "string" }, religion: { type: "string" }, caste: { type: "string" },
        education: { type: "string" }, occupation: { type: "string" }, maritalStatus: { type: "string" },
        knownLanguages: { type: "array", items: { type: "string" } },
        mobileNumbers: { type: "array", items: { type: "string" } },
        emailAddresses: { type: "array", items: { type: "string" } },
        socialHandles: { type: "array", items: { type: "object", additionalProperties: true } },
        monitoringStatus: { type: "string", enum: ["NONE", "ACTIVE", "WATCH", "SURVEILLANCE"] },
        threatLevel: { type: "string", enum: ["UNKNOWN", "LOW", "MEDIUM", "HIGH", "CRITICAL"] },
        sourceSystem: { type: "string" }, cctnsId: { type: "string" },
        fieldProvenance: { type: "object", additionalProperties: true },
        ...NEW_BODY_PROPS,
      } },
    },
  }, async (request, reply) => {
    if (!requireSubjectWrite(request, reply)) return;
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;

    const fieldMap: Record<string, string> = {
      fullName: "full_name", aliases: "aliases", fatherName: "father_name", motherName: "mother_name",
      spouseName: "spouse_name", dateOfBirth: "date_of_birth", gender: "gender",
      heightCm: "height_cm", weightKg: "weight_kg", complexion: "complexion",
      distinguishingMarks: "distinguishing_marks", bloodGroup: "blood_group",
      nationality: "nationality", religion: "religion", caste: "caste",
      education: "education", occupation: "occupation", maritalStatus: "marital_status",
      knownLanguages: "known_languages", mobileNumbers: "mobile_numbers",
      emailAddresses: "email_addresses",
      socialHandles: "social_handles", monitoringStatus: "monitoring_status",
      threatLevel: "threat_level", sourceSystem: "source_system", cctnsId: "cctns_id",
      fieldProvenance: "field_provenance",
      ...NEW_FIELD_MAP,
    };

    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;

    for (const [bodyKey, col] of Object.entries(fieldMap)) {
      if (body[bodyKey] !== undefined) {
        if (ARRAY_FIELDS.has(bodyKey)) {
          sets.push(`${col} = $${idx++}::text[]`);
          params.push(body[bodyKey]);
        } else if (JSON_FIELDS.has(bodyKey)) {
          sets.push(`${col} = $${idx++}`);
          params.push(JSON.stringify(body[bodyKey]));
        } else {
          sets.push(`${col} = $${idx++}`);
          params.push(body[bodyKey]);
        }
      }
    }

    if (sets.length === 0) {
      return send400(reply, "NO_FIELDS", "No fields to update");
    }

    sets.push(`updated_at = NOW()`);
    params.push(id);

    const result = await query(
      `UPDATE subject_profile SET ${sets.join(", ")} WHERE subject_id = $${idx}
       RETURNING subject_id, full_name, aliases, state_id, source_system, updated_at`,
      params,
    );
    if (result.rows.length === 0) {
      return send404(reply, "SUBJECT_NOT_FOUND", "Subject not found");
    }

    // FR-04 AC-05 / BR-01/BR-02: Detect assertion conflicts when sources differ
    const sourceSystem = body.sourceSystem as string | undefined;
    if (sourceSystem) {
      const TRUST_RANKING: Record<string, number> = { CCTNS: 4, ECOURTS: 3, NDPS: 2, MANUAL: 1 };
      const currentSource = result.rows[0].source_system || "MANUAL";
      const CONFLICT_FIELDS = ["full_name", "date_of_birth", "gender", "father_name", "identifiers"];
      for (const field of CONFLICT_FIELDS) {
        const camelKey = Object.entries(fieldMap).find(([, col]) => col === field)?.[0];
        if (camelKey && body[camelKey] !== undefined) {
          // Legacy: Insert conflict record for audit (backward compat)
          await query(
            `INSERT INTO assertion_conflict (subject_id, field_name, source_a, value_a, source_b, value_b, resolution, resolved_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
             ON CONFLICT DO NOTHING`,
            [
              id, field, currentSource, "previous_value",
              sourceSystem, String(body[camelKey]),
              (TRUST_RANKING[sourceSystem] || 0) >= (TRUST_RANKING[currentSource] || 0) ? sourceSystem : currentSource,
            ],
          );

          // New: Insert into assertion engine for proper provenance tracking
          try {
            await insertAssertion({
              subjectId: id,
              attributeName: field,
              attributeValue: String(body[camelKey]),
              sourceSystem,
              createdBy: request.authUser!.userId,
            });
          } catch { /* best-effort — legacy assertion_conflict is primary */ }
        }
      }
    }

    // Dual-write: sync phone numbers to normalized tables on update
    if (body.mobileNumbers !== undefined) {
      const mobileNumbers = body.mobileNumbers as string[];
      const src = sourceSystem || "MANUAL";
      for (const num of mobileNumbers) {
        try {
          const phoneId = await upsertPhone(num);
          await linkPhoneToSubject(id, phoneId, "OWNER", src);
        } catch { /* best-effort */ }
      }
    }

    return { subject: result.rows[0] };
  });

  // ---------- TRANSITIONS ----------
  app.get("/api/v1/subjects/:id/transitions", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await query(`SELECT state_id FROM subject_profile WHERE subject_id = $1`, [id]);
    if (result.rows.length === 0) return send404(reply, "SUBJECT_NOT_FOUND", "Subject not found");
    return { transitions: getAvailableTransitions("dopams_subject", result.rows[0].state_id) };
  });

  app.post("/api/v1/subjects/:id/transition", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      body: { type: "object", additionalProperties: false, required: ["transitionId"], properties: { transitionId: { type: "string" }, remarks: { type: "string" } } },
    },
  }, async (request, reply) => {
    if (!requireSubjectWrite(request, reply)) return;
    const { id } = request.params as { id: string };
    const { transitionId, remarks } = request.body as { transitionId: string; remarks?: string };
    const { userId, roles } = request.authUser!;

    const result = await executeTransition(
      id, "dopams_subject", transitionId, userId, "OFFICER", roles, remarks,
    );
    if (!result.success) {
      if (result.error === "ENTITY_NOT_FOUND") return send404(reply, "SUBJECT_NOT_FOUND", "Subject not found");
      return sendError(reply, 409, result.error || "TRANSITION_FAILED", "Subject transition failed");
    }
    return { success: true, newStateId: result.newStateId };
  });
}
