import { query, getClient } from "../db";
import {
  normalizePhone,
  normalizeBankAccount,
  normalizeIdentityDoc,
  normalizeSocialHandle,
  normalizeVehicleReg,
} from "./entity-normalizer";
import { rebuildGraph } from "./graph-projector";

/**
 * Entity Sync — extracts JSONB fields from subject_profile and upserts into
 * normalized entity tables + link tables, then rebuilds the network graph.
 *
 * This bridges the gap between the denormalized JSONB storage (always populated)
 * and the normalized entity layer (used by NL query, graph, and dedup).
 */

export interface SyncStats {
  subjectsProcessed: number;
  phonesUpserted: number;
  identityDocsUpserted: number;
  bankAccountsUpserted: number;
  socialAccountsUpserted: number;
  vehiclesUpserted: number;
  addressesUpserted: number;
  linksCreated: number;
  graphNodesUpserted: number;
  graphEdgesUpserted: number;
  errors: string[];
}

type SubjectRow = Record<string, unknown>;

/**
 * Sync all subjects' JSONB data into normalized entity tables.
 */
export async function syncAllEntities(): Promise<SyncStats> {
  const stats: SyncStats = {
    subjectsProcessed: 0,
    phonesUpserted: 0,
    identityDocsUpserted: 0,
    bankAccountsUpserted: 0,
    socialAccountsUpserted: 0,
    vehiclesUpserted: 0,
    addressesUpserted: 0,
    linksCreated: 0,
    graphNodesUpserted: 0,
    graphEdgesUpserted: 0,
    errors: [],
  };

  const subjects = await query(
    `SELECT subject_id, full_name,
            mobile_numbers, identifiers, bank_account_details, social_handles,
            passport_details, driving_license_details, vehicle_rc_details,
            addresses, residential_address, native_or_permanent_address
     FROM subject_profile WHERE is_merged = FALSE`,
  );

  for (const subject of subjects.rows) {
    try {
      await syncSubjectEntities(subject, stats);
      stats.subjectsProcessed++;
    } catch (err) {
      const msg = `Subject ${subject.subject_id} (${subject.full_name}): ${(err as Error).message}`;
      stats.errors.push(msg);
    }
  }

  // Rebuild network graph after entity sync
  try {
    const graphStats = await rebuildGraph();
    stats.graphNodesUpserted = graphStats.nodesUpserted;
    stats.graphEdgesUpserted = graphStats.edgesUpserted;
  } catch (err) {
    stats.errors.push(`Graph rebuild: ${(err as Error).message}`);
  }

  return stats;
}

async function syncSubjectEntities(subject: SubjectRow, stats: SyncStats): Promise<void> {
  const subjectId = subject.subject_id as string;

  await syncPhones(subjectId, subject.mobile_numbers, stats);
  await syncIdentifiers(subjectId, subject.identifiers as Record<string, string> | null, stats);
  await syncPassport(subjectId, subject.passport_details as Record<string, string> | null, stats);
  await syncDrivingLicense(subjectId, subject.driving_license_details as Record<string, string> | null, stats);
  await syncBankAccounts(subjectId, subject.bank_account_details, stats);
  await syncSocialHandles(subjectId, subject.social_handles, stats);
  await syncVehicles(subjectId, subject.vehicle_rc_details, stats);
  await syncAddresses(
    subjectId,
    subject.addresses,
    subject.residential_address as string | null,
    subject.native_or_permanent_address as string | null,
    stats,
  );
}

// ─── Phone Numbers ──────────────────────────────────────────────────────────

async function syncPhones(subjectId: string, mobileNumbers: unknown, stats: SyncStats): Promise<void> {
  const phones = parseJsonbArray(mobileNumbers);
  if (phones.length === 0) return;

  for (const entry of phones) {
    const raw = typeof entry === "string" ? entry : (entry as Record<string, string>)?.number;
    if (!raw) continue;

    const normalized = normalizePhone(raw);
    if (normalized.length < 10) continue;

    const result = await query(
      `INSERT INTO phone_number (raw_value, normalized_value, phone_type)
       VALUES ($1, $2, 'MOBILE')
       ON CONFLICT (normalized_value) DO UPDATE SET raw_value = EXCLUDED.raw_value
       RETURNING phone_id`,
      [raw, normalized],
    );
    const phoneId = result.rows[0].phone_id;
    stats.phonesUpserted++;

    await upsertLink("subject_phone_link", "phone_id", subjectId, phoneId, "OWNER", stats);
  }
}

// ─── Identity Documents (from identifiers JSONB) ───────────────────────────

async function syncIdentifiers(
  subjectId: string,
  identifiers: Record<string, string> | null,
  stats: SyncStats,
): Promise<void> {
  if (!identifiers || typeof identifiers !== "object") return;

  const docMap: Array<{ key: string; docType: string }> = [
    { key: "aadhaarHash", docType: "AADHAAR" },
    { key: "panNumber", docType: "PAN" },
    { key: "voterId", docType: "VOTER_ID" },
    { key: "drivingLicense", docType: "DRIVING_LICENSE" },
    { key: "passportNumber", docType: "PASSPORT" },
  ];

  for (const { key, docType } of docMap) {
    const rawValue = identifiers[key];
    if (!rawValue || rawValue === "—" || rawValue === "-") continue;

    const normalized = normalizeIdentityDoc(docType, rawValue);
    const result = await query(
      `INSERT INTO identity_document (document_type, document_value, normalized_value)
       VALUES ($1, $2, $3)
       ON CONFLICT (document_type, normalized_value) DO UPDATE SET document_value = EXCLUDED.document_value
       RETURNING document_pk`,
      [docType, rawValue, normalized],
    );
    stats.identityDocsUpserted++;
    await upsertLink("subject_identity_link", "document_pk", subjectId, result.rows[0].document_pk, null, stats);
  }
}

// ─── Passport (from passport_details JSONB) ─────────────────────────────────

async function syncPassport(
  subjectId: string,
  passportDetails: Record<string, string> | null,
  stats: SyncStats,
): Promise<void> {
  if (!passportDetails || !passportDetails.number) return;

  const raw = passportDetails.number;
  const normalized = normalizeIdentityDoc("PASSPORT", raw);

  const result = await query(
    `INSERT INTO identity_document (document_type, document_value, normalized_value)
     VALUES ('PASSPORT', $1, $2)
     ON CONFLICT (document_type, normalized_value) DO UPDATE SET document_value = EXCLUDED.document_value
     RETURNING document_pk`,
    [raw, normalized],
  );
  stats.identityDocsUpserted++;
  await upsertLink("subject_identity_link", "document_pk", subjectId, result.rows[0].document_pk, null, stats);
}

// ─── Driving License (from driving_license_details JSONB) ───────────────────

async function syncDrivingLicense(
  subjectId: string,
  dlDetails: Record<string, string> | null,
  stats: SyncStats,
): Promise<void> {
  if (!dlDetails || !dlDetails.number) return;

  const raw = dlDetails.number;
  const normalized = normalizeIdentityDoc("DRIVING_LICENSE", raw);

  const result = await query(
    `INSERT INTO identity_document (document_type, document_value, normalized_value)
     VALUES ('DRIVING_LICENSE', $1, $2)
     ON CONFLICT (document_type, normalized_value) DO UPDATE SET document_value = EXCLUDED.document_value
     RETURNING document_pk`,
    [raw, normalized],
  );
  stats.identityDocsUpserted++;
  await upsertLink("subject_identity_link", "document_pk", subjectId, result.rows[0].document_pk, null, stats);
}

// ─── Bank Accounts ──────────────────────────────────────────────────────────

async function syncBankAccounts(subjectId: string, bankDetails: unknown, stats: SyncStats): Promise<void> {
  const accounts = parseJsonbArray(bankDetails);
  if (accounts.length === 0) return;

  for (const entry of accounts) {
    const acc = entry as Record<string, string>;
    const accountNumber = acc.account || acc.account_number;
    const ifsc = acc.ifsc || acc.ifsc_code;
    const bankName = acc.bank || acc.bank_name;
    const branch = acc.branch || acc.branch_name;

    // Need at least account number to create a normalized key
    if (!accountNumber) continue;

    const normalizedKey = ifsc
      ? `${normalizeBankAccount(accountNumber)}@${ifsc.toUpperCase()}`
      : normalizeBankAccount(accountNumber);

    const result = await query(
      `INSERT INTO bank_account (account_number, ifsc_code, normalized_key, bank_name, branch_name,
         account_type)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (normalized_key) DO UPDATE
         SET bank_name = COALESCE(EXCLUDED.bank_name, bank_account.bank_name),
             branch_name = COALESCE(EXCLUDED.branch_name, bank_account.branch_name)
       RETURNING account_id`,
      [
        accountNumber,
        ifsc || null,
        normalizedKey,
        bankName || null,
        branch || null,
        mapAccountType(acc.type || acc.account_type),
      ],
    );
    stats.bankAccountsUpserted++;
    await upsertLink("subject_account_link", "account_id", subjectId, result.rows[0].account_id, "HOLDER", stats);
  }
}

// ─── Social Handles ─────────────────────────────────────────────────────────

async function syncSocialHandles(subjectId: string, socialHandles: unknown, stats: SyncStats): Promise<void> {
  const handles = parseJsonbArray(socialHandles);
  if (handles.length === 0) return;

  for (const entry of handles) {
    const h = entry as Record<string, string>;
    const platform = h.platform;
    const handle = h.handle || h.username || h.id;
    if (!platform || !handle) continue;

    const normalizedHandle = normalizeSocialHandle(handle);
    const normalizedPlatform = platform.replace(/\s+/g, "_").toLowerCase();

    const result = await query(
      `INSERT INTO social_account (platform, handle, normalized_handle)
       VALUES ($1, $2, $3)
       ON CONFLICT (platform, normalized_handle) DO UPDATE SET handle = EXCLUDED.handle
       RETURNING social_id`,
      [normalizedPlatform, handle, normalizedHandle],
    );
    stats.socialAccountsUpserted++;
    await upsertLink("subject_social_link", "social_id", subjectId, result.rows[0].social_id, "OWNER", stats);
  }
}

// ─── Vehicles ───────────────────────────────────────────────────────────────

async function syncVehicles(subjectId: string, vehicleDetails: unknown, stats: SyncStats): Promise<void> {
  const vehicles = parseJsonbArray(vehicleDetails);
  if (vehicles.length === 0) return;

  for (const entry of vehicles) {
    const v = entry as Record<string, string | number>;
    const regNo = (v.registration || v.registration_no || v.reg_no) as string;
    if (!regNo) continue;

    const normalizedReg = normalizeVehicleReg(regNo);
    const vehicleName = (v.vehicle || v.make_model || "") as string;
    // Try to split "Mahindra Scorpio" into make + model
    const parts = vehicleName.split(/\s+/);
    const make = parts[0] || null;
    const model = parts.slice(1).join(" ") || null;

    const result = await query(
      `INSERT INTO vehicle (registration_no, normalized_reg, make, model, year_of_manufacture)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (normalized_reg) DO UPDATE
         SET make = COALESCE(EXCLUDED.make, vehicle.make),
             model = COALESCE(EXCLUDED.model, vehicle.model)
       RETURNING vehicle_id`,
      [regNo, normalizedReg, make, model, v.year || null],
    );
    stats.vehiclesUpserted++;
    await upsertLink("subject_vehicle_link", "vehicle_id", subjectId, result.rows[0].vehicle_id, "OWNER", stats);
  }
}

// ─── Addresses ──────────────────────────────────────────────────────────────

async function syncAddresses(
  subjectId: string,
  addressesJsonb: unknown,
  residentialAddress: string | null,
  permanentAddress: string | null,
  stats: SyncStats,
): Promise<void> {
  // 1. Sync from JSONB array (addresses column)
  const addrList = parseJsonbArray(addressesJsonb);
  for (const entry of addrList) {
    if (typeof entry === "string") {
      if (entry.trim()) {
        await upsertAddress(subjectId, entry.trim(), "RESIDENTIAL", stats);
      }
    } else {
      const a = entry as Record<string, string>;
      const raw = a.address || a.full_address || a.raw_address;
      if (raw) {
        await upsertAddress(subjectId, raw, a.type || "RESIDENTIAL", stats);
      }
    }
  }

  // 2. Sync from scalar residential_address field
  if (residentialAddress && residentialAddress.trim()) {
    await upsertAddress(subjectId, residentialAddress.trim(), "RESIDENTIAL", stats);
  }

  // 3. Sync from scalar native_or_permanent_address field
  if (permanentAddress && permanentAddress.trim()) {
    await upsertAddress(subjectId, permanentAddress.trim(), "PERMANENT", stats);
  }
}

async function upsertAddress(
  subjectId: string,
  rawAddress: string,
  addressType: string,
  stats: SyncStats,
): Promise<void> {
  // Extract pincode if present
  const pincodeMatch = rawAddress.match(/\b(\d{6})\b/);
  const pincode = pincodeMatch ? pincodeMatch[1] : null;

  // Validate address_type against CHECK constraint
  const validTypes = [
    "RESIDENTIAL", "PERMANENT", "OFFICE", "HIDEOUT", "SAFEHOUSE", "OPERATIONAL",
    "STASH_HOUSE", "MANUFACTURING_LAB", "FREQUENT_HANGOUT", "TEMPORARY", "UNKNOWN",
  ];
  const safeType = validTypes.includes(addressType.toUpperCase()) ? addressType.toUpperCase() : "RESIDENTIAL";

  // Use raw_address as dedup key — check for existing address
  const existing = await query(
    `SELECT address_id FROM address WHERE raw_address = $1 AND address_type = $2 LIMIT 1`,
    [rawAddress, safeType],
  );

  let addressId: string;
  if (existing.rows.length > 0) {
    addressId = existing.rows[0].address_id as string;
  } else {
    const result = await query(
      `INSERT INTO address (raw_address, pincode, address_type)
       VALUES ($1, $2, $3)
       RETURNING address_id`,
      [rawAddress, pincode, safeType],
    );
    addressId = result.rows[0].address_id as string;
    stats.addressesUpserted++;
  }

  const relationship = safeType === "HIDEOUT" || safeType === "SAFEHOUSE" ? "HIDEOUT"
    : safeType === "OFFICE" ? "WORK"
    : safeType === "FREQUENT_HANGOUT" ? "FREQUENT"
    : "RESIDENT";

  await upsertLink("subject_address_link", "address_id", subjectId, addressId, relationship, stats);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Generic link upsert — works for any subject_*_link table.
 */
async function upsertLink(
  table: string,
  entityCol: string,
  subjectId: string,
  entityId: string,
  relationship: string | null,
  stats: SyncStats,
): Promise<void> {
  // subject_identity_link has unique on (subject_id, document_pk) — no relationship column in unique
  if (table === "subject_identity_link") {
    await query(
      `INSERT INTO subject_identity_link (subject_id, document_pk, source_system)
       VALUES ($1, $2, 'entity_sync')
       ON CONFLICT (subject_id, document_pk) DO NOTHING`,
      [subjectId, entityId],
    );
  } else if (table === "subject_address_link") {
    await query(
      `INSERT INTO subject_address_link (subject_id, address_id, relationship, source_system)
       VALUES ($1, $2, $3, 'entity_sync')
       ON CONFLICT (subject_id, address_id, relationship) DO NOTHING`,
      [subjectId, entityId, relationship || "RESIDENT"],
    );
  } else {
    // Generic: subject_phone_link, subject_account_link, subject_social_link, subject_vehicle_link
    await query(
      `INSERT INTO ${table} (subject_id, ${entityCol}, relationship, source_system)
       VALUES ($1, $2, $3, 'entity_sync')
       ON CONFLICT (subject_id, ${entityCol}, relationship) DO NOTHING`,
      [subjectId, entityId, relationship || "OWNER"],
    );
  }
  stats.linksCreated++;
}

function parseJsonbArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function mapAccountType(raw: string | undefined): string | null {
  if (!raw) return null;
  const upper = raw.toUpperCase().replace(/\s+/g, "_");
  const valid = ["SAVINGS", "CURRENT", "FIXED_DEPOSIT", "RECURRING", "NRI", "OTHER"];
  return valid.includes(upper) ? upper : null;
}
