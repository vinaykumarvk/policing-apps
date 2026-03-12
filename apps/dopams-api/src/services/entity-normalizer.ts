import { query } from "../db";

/**
 * Entity Normalizer — standardizes entity values for dedup and graph matching.
 * Each normalizer returns the canonical form for comparison.
 */

// ─── Phone Normalization ───────────────────────────────────────────────────────

/**
 * Normalize Indian phone numbers to 10-digit format.
 * Strips +91, 0 prefix, spaces, dashes.
 */
export function normalizePhone(raw: string): string {
  let n = raw.replace(/[\s\-().]/g, "");
  if (n.startsWith("+91")) n = n.slice(3);
  if (n.startsWith("91") && n.length === 12) n = n.slice(2);
  if (n.startsWith("0") && n.length === 11) n = n.slice(1);
  return n;
}

// ─── IMEI Normalization ────────────────────────────────────────────────────────

/**
 * Normalize IMEI to 15-digit string (strip check digit variant, spaces, dashes).
 */
export function normalizeIMEI(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.slice(0, 15);
}

// ─── Vehicle Registration ──────────────────────────────────────────────────────

/**
 * Normalize Indian vehicle registration (e.g., "DL 01 ABC 1234" → "DL01ABC1234").
 */
export function normalizeVehicleReg(raw: string): string {
  return raw.replace(/[\s\-]/g, "").toUpperCase();
}

// ─── Identity Documents ────────────────────────────────────────────────────────

/**
 * Normalize identity document values by type.
 */
export function normalizeIdentityDoc(docType: string, raw: string): string {
  switch (docType) {
    case "AADHAAR":
      return raw.replace(/[\s\-]/g, "");
    case "PAN":
      return raw.replace(/\s/g, "").toUpperCase();
    case "PASSPORT":
      return raw.replace(/\s/g, "").toUpperCase();
    case "DRIVING_LICENSE":
      return raw.replace(/[\s\-]/g, "").toUpperCase();
    case "VOTER_ID":
      return raw.replace(/\s/g, "").toUpperCase();
    default:
      return raw.trim();
  }
}

// ─── Social Handle ─────────────────────────────────────────────────────────────

/**
 * Normalize social media handle: lowercase, strip leading @.
 */
export function normalizeSocialHandle(raw: string): string {
  return raw.replace(/^@/, "").toLowerCase().trim();
}

// ─── Bank Account ──────────────────────────────────────────────────────────────

/**
 * Normalize bank account number (strip spaces/dashes).
 */
export function normalizeBankAccount(raw: string): string {
  return raw.replace(/[\s\-]/g, "");
}

/**
 * Normalize UPI ID: lowercase, trim.
 */
export function normalizeUPI(raw: string): string {
  return raw.toLowerCase().trim();
}

// ─── Upsert Helpers ────────────────────────────────────────────────────────────

/**
 * Upsert a phone number and return the phone_id. Deduplicates on normalized value.
 */
export async function upsertPhone(
  rawValue: string,
  phoneType: string = "MOBILE",
): Promise<string> {
  const normalized = normalizePhone(rawValue);
  const result = await query(
    `INSERT INTO phone_number (raw_value, normalized_value, phone_type)
     VALUES ($1, $2, $3)
     ON CONFLICT (normalized_value) DO UPDATE SET raw_value = EXCLUDED.raw_value
     RETURNING phone_id`,
    [rawValue, normalized, phoneType],
  );
  return result.rows[0].phone_id;
}

/**
 * Upsert an identity document and return the document_pk.
 */
export async function upsertIdentityDoc(
  docType: string,
  rawValue: string,
): Promise<string> {
  const normalized = normalizeIdentityDoc(docType, rawValue);
  const result = await query(
    `INSERT INTO identity_document (document_type, document_value, normalized_value)
     VALUES ($1, $2, $3)
     ON CONFLICT (document_type, normalized_value) DO UPDATE SET document_value = EXCLUDED.document_value
     RETURNING document_pk`,
    [docType, rawValue, normalized],
  );
  return result.rows[0].document_pk;
}

/**
 * Link a phone to a subject (upsert — no duplicate links).
 */
export async function linkPhoneToSubject(
  subjectId: string,
  phoneId: string,
  relationship: string = "OWNER",
  sourceSystem?: string,
): Promise<void> {
  await query(
    `INSERT INTO subject_phone_link (subject_id, phone_id, relationship, source_system)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (subject_id, phone_id, relationship) DO NOTHING`,
    [subjectId, phoneId, relationship, sourceSystem || null],
  );
}

/**
 * Link an identity document to a subject (upsert).
 */
export async function linkIdentityToSubject(
  subjectId: string,
  documentPk: string,
  sourceSystem?: string,
): Promise<void> {
  await query(
    `INSERT INTO subject_identity_link (subject_id, document_pk, source_system)
     VALUES ($1, $2, $3)
     ON CONFLICT (subject_id, document_pk) DO NOTHING`,
    [subjectId, documentPk, sourceSystem || null],
  );
}

/**
 * Find subjects linked to a given phone number (by normalized value).
 */
export async function findSubjectsByPhone(rawPhone: string): Promise<Array<{ subject_id: string; full_name: string; relationship: string }>> {
  const normalized = normalizePhone(rawPhone);
  const result = await query(
    `SELECT sp.subject_id, sp.full_name, spl.relationship
     FROM subject_phone_link spl
     JOIN phone_number pn ON pn.phone_id = spl.phone_id
     JOIN subject_profile sp ON sp.subject_id = spl.subject_id
     WHERE pn.normalized_value = $1 AND sp.is_merged = FALSE`,
    [normalized],
  );
  return result.rows;
}

/**
 * Find subjects linked to a given identity document (by normalized value).
 */
export async function findSubjectsByIdentity(
  docType: string,
  rawValue: string,
): Promise<Array<{ subject_id: string; full_name: string }>> {
  const normalized = normalizeIdentityDoc(docType, rawValue);
  const result = await query(
    `SELECT sp.subject_id, sp.full_name
     FROM subject_identity_link sil
     JOIN identity_document id ON id.document_pk = sil.document_pk
     JOIN subject_profile sp ON sp.subject_id = sil.subject_id
     WHERE id.document_type = $1 AND id.normalized_value = $2 AND sp.is_merged = FALSE`,
    [docType, normalized],
  );
  return result.rows;
}
