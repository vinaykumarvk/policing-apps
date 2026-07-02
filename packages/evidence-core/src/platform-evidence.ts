export const PLATFORM_EVIDENCE_PROJECTION_SCHEMA_VERSION = "platform.evidence_projection.v1";

export type EvidenceClassificationLevel = "public" | "restricted" | "confidential" | "secret";
export type EvidenceSourceStatus =
  | "active"
  | "deleted"
  | "sealed"
  | "purged"
  | "superseded"
  | "retained_inaccessible"
  | "unknown";
export type EvidenceLegalHoldStatus = "none" | "active" | "released" | "unknown";
export type EvidenceRetentionStatus = "active" | "hold" | "archive_due" | "purge_due" | "unknown";
export type EvidenceRedactionProfile = "evidence-metadata-v1" | "legal-review-v1" | "deny-none";
export type EvidenceRedactionReason = "central_metadata_only" | "legal_review" | "deny_no_data_returned";

export type EvidenceField =
  | "evidence_id"
  | "case_id"
  | "source_system"
  | "source_record_id"
  | "display_name"
  | "mime_type"
  | "size_bytes"
  | "hash_sha256"
  | "chain_of_custody_head"
  | "classification"
  | "legal_hold_status"
  | "retention_status"
  | "source_version"
  | "projection_version"
  | "storage_uri";

export interface PlatformEvidenceProjection {
  schema_version: typeof PLATFORM_EVIDENCE_PROJECTION_SCHEMA_VERSION;
  evidence_id: string;
  case_id: string;
  source_system: string;
  source_record_id: string;
  display_name: string;
  mime_type: string;
  size_bytes: number;
  hash_sha256: string;
  chain_of_custody_head: string;
  classification: EvidenceClassificationLevel;
  legal_hold_status: EvidenceLegalHoldStatus;
  retention_status: EvidenceRetentionStatus;
  source_version: string;
  projection_version: string;
  projected_at: string;
  source_status: EvidenceSourceStatus;
  storage_uri?: string | null;
}

export interface EvidenceRedactionDecision {
  profile: EvidenceRedactionProfile;
  fields_redacted: EvidenceField[];
  storage_uri_exposed: false;
  reason: EvidenceRedactionReason;
}

export interface PlatformEvidenceReadModel {
  evidence_id: string | null;
  case_id: string | null;
  source_system: string | null;
  source_record_id: string | null;
  display_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  hash_sha256: string | null;
  chain_of_custody_head: string | null;
  classification: EvidenceClassificationLevel | null;
  legal_hold_status: EvidenceLegalHoldStatus | null;
  retention_status: EvidenceRetentionStatus | null;
  source_version: string | null;
  projection_version: string | null;
  redaction_decision: EvidenceRedactionDecision;
}

export type EvidenceProjectionValidationReason =
  | "INPUT_NOT_OBJECT"
  | "UNSUPPORTED_SCHEMA_VERSION"
  | "REQUIRED_FIELD_MISSING"
  | "INVALID_ENUM"
  | "INVALID_TIMESTAMP"
  | "INVALID_SIZE"
  | "INVALID_REDACTION_DECISION";

export type EvidenceProjectionValidationResult =
  | { valid: true; projection: PlatformEvidenceProjection; issues: [] }
  | { valid: false; reason: EvidenceProjectionValidationReason; issues: string[] };

export type EvidenceRedactionDecisionValidationResult =
  | { valid: true; decision: EvidenceRedactionDecision; issues: [] }
  | { valid: false; reason: "INVALID_REDACTION_DECISION"; issues: string[] };

export class EvidenceProjectionValidationError extends Error {
  readonly reason: EvidenceProjectionValidationReason;
  readonly issues: string[];

  constructor(reason: EvidenceProjectionValidationReason, issues: string[]) {
    super(`platform evidence projection is invalid: ${issues.join("; ")}`);
    this.name = "EvidenceProjectionValidationError";
    this.reason = reason;
    this.issues = [...issues];
  }
}

const CLASSIFICATION_LEVELS: readonly EvidenceClassificationLevel[] = ["public", "restricted", "confidential", "secret"];
const SOURCE_STATUSES: readonly EvidenceSourceStatus[] = [
  "active",
  "deleted",
  "sealed",
  "purged",
  "superseded",
  "retained_inaccessible",
  "unknown",
];
const LEGAL_HOLD_STATUSES: readonly EvidenceLegalHoldStatus[] = ["none", "active", "released", "unknown"];
const RETENTION_STATUSES: readonly EvidenceRetentionStatus[] = ["active", "hold", "archive_due", "purge_due", "unknown"];
const REDACTION_PROFILES: readonly EvidenceRedactionProfile[] = ["evidence-metadata-v1", "legal-review-v1", "deny-none"];
const EVIDENCE_FIELDS: readonly EvidenceField[] = [
  "evidence_id",
  "case_id",
  "source_system",
  "source_record_id",
  "display_name",
  "mime_type",
  "size_bytes",
  "hash_sha256",
  "chain_of_custody_head",
  "classification",
  "legal_hold_status",
  "retention_status",
  "source_version",
  "projection_version",
  "storage_uri",
];
const REDACTION_FIELDS_BY_PROFILE: Record<EvidenceRedactionProfile, readonly EvidenceField[]> = {
  "evidence-metadata-v1": [
    "hash_sha256",
    "chain_of_custody_head",
    "legal_hold_status",
    "retention_status",
    "storage_uri",
  ],
  "legal-review-v1": ["storage_uri"],
  "deny-none": EVIDENCE_FIELDS,
};
const REDACTION_REASON_BY_PROFILE: Record<EvidenceRedactionProfile, EvidenceRedactionReason> = {
  "evidence-metadata-v1": "central_metadata_only",
  "legal-review-v1": "legal_review",
  "deny-none": "deny_no_data_returned",
};

export function validatePlatformEvidenceProjection(input: unknown): EvidenceProjectionValidationResult {
  if (!isRecord(input)) {
    return invalid("INPUT_NOT_OBJECT", "evidence projection must be an object");
  }

  const issues: string[] = [];
  const schemaVersion = requireString(input, "schema_version", issues);
  const evidenceId = requireString(input, "evidence_id", issues);
  const caseId = requireString(input, "case_id", issues);
  const sourceSystem = requireString(input, "source_system", issues);
  const sourceRecordId = requireString(input, "source_record_id", issues);
  const displayName = requireString(input, "display_name", issues);
  const mimeType = requireString(input, "mime_type", issues);
  const sizeBytes = requireNonNegativeInteger(input, "size_bytes", issues);
  const hashSha256 = requireString(input, "hash_sha256", issues);
  const chainOfCustodyHead = requireString(input, "chain_of_custody_head", issues);
  const classification = requireEnum(input, "classification", CLASSIFICATION_LEVELS, issues);
  const legalHoldStatus = requireEnum(input, "legal_hold_status", LEGAL_HOLD_STATUSES, issues);
  const retentionStatus = requireEnum(input, "retention_status", RETENTION_STATUSES, issues);
  const sourceVersion = requireString(input, "source_version", issues);
  const projectionVersion = requireString(input, "projection_version", issues);
  const projectedAt = requireIsoTimestamp(input, "projected_at", issues);
  const sourceStatus = requireEnum(input, "source_status", SOURCE_STATUSES, issues);
  const storageUri = optionalString(input.storage_uri, "storage_uri", issues);

  if (issues.length > 0) {
    return invalid(classifyIssues(issues), ...issues);
  }

  if (schemaVersion !== PLATFORM_EVIDENCE_PROJECTION_SCHEMA_VERSION) {
    return invalid("UNSUPPORTED_SCHEMA_VERSION", `unsupported schema_version ${schemaVersion}`);
  }

  return {
    valid: true,
    projection: {
      schema_version: PLATFORM_EVIDENCE_PROJECTION_SCHEMA_VERSION,
      evidence_id: evidenceId,
      case_id: caseId,
      source_system: sourceSystem,
      source_record_id: sourceRecordId,
      display_name: displayName,
      mime_type: mimeType,
      size_bytes: sizeBytes,
      hash_sha256: hashSha256,
      chain_of_custody_head: chainOfCustodyHead,
      classification,
      legal_hold_status: legalHoldStatus,
      retention_status: retentionStatus,
      source_version: sourceVersion,
      projection_version: projectionVersion,
      projected_at: projectedAt,
      source_status: sourceStatus,
      storage_uri: storageUri,
    },
    issues: [],
  };
}

export function createEvidenceRedactionDecision(profile: EvidenceRedactionProfile): EvidenceRedactionDecision {
  return {
    profile,
    fields_redacted: [...REDACTION_FIELDS_BY_PROFILE[profile]],
    storage_uri_exposed: false,
    reason: REDACTION_REASON_BY_PROFILE[profile],
  };
}

export function validateEvidenceRedactionDecision(input: unknown): EvidenceRedactionDecisionValidationResult {
  if (!isRecord(input)) {
    return invalidRedaction("redaction decision must be an object");
  }

  const issues: string[] = [];
  const profile = requireEnum(input, "profile", REDACTION_PROFILES, issues);
  const fieldsRedacted = requireEvidenceFieldArray(input, "fields_redacted", issues);
  if (input.storage_uri_exposed !== false) {
    issues.push("storage_uri_exposed must be false for platform evidence responses");
  }
  if (!fieldsRedacted.includes("storage_uri")) {
    issues.push("storage_uri must always be redacted from platform evidence responses");
  }
  if (input.reason !== REDACTION_REASON_BY_PROFILE[profile]) {
    issues.push(`reason must be ${REDACTION_REASON_BY_PROFILE[profile]} for profile ${profile}`);
  }

  if (issues.length > 0) {
    return invalidRedaction(...issues);
  }

  return {
    valid: true,
    decision: {
      profile,
      fields_redacted: fieldsRedacted,
      storage_uri_exposed: false,
      reason: REDACTION_REASON_BY_PROFILE[profile],
    },
    issues: [],
  };
}

export function toPlatformEvidenceReadModel(
  input: unknown,
  redaction: EvidenceRedactionDecision,
): PlatformEvidenceReadModel {
  const validation = validatePlatformEvidenceProjection(input);
  if (!validation.valid) {
    throw new EvidenceProjectionValidationError(validation.reason, validation.issues);
  }

  const redactionValidation = validateEvidenceRedactionDecision(redaction);
  if (!redactionValidation.valid) {
    throw new EvidenceProjectionValidationError(redactionValidation.reason, redactionValidation.issues);
  }

  const projection = validation.projection;
  return {
    evidence_id: redact(projection.evidence_id, "evidence_id", redaction),
    case_id: redact(projection.case_id, "case_id", redaction),
    source_system: redact(projection.source_system, "source_system", redaction),
    source_record_id: redact(projection.source_record_id, "source_record_id", redaction),
    display_name: redact(projection.display_name, "display_name", redaction),
    mime_type: redact(projection.mime_type, "mime_type", redaction),
    size_bytes: redact(projection.size_bytes, "size_bytes", redaction),
    hash_sha256: redact(projection.hash_sha256, "hash_sha256", redaction),
    chain_of_custody_head: redact(projection.chain_of_custody_head, "chain_of_custody_head", redaction),
    classification: redact(projection.classification, "classification", redaction),
    legal_hold_status: redact(projection.legal_hold_status, "legal_hold_status", redaction),
    retention_status: redact(projection.retention_status, "retention_status", redaction),
    source_version: redact(projection.source_version, "source_version", redaction),
    projection_version: redact(projection.projection_version, "projection_version", redaction),
    redaction_decision: cloneEvidenceRedactionDecision(redaction),
  };
}

function invalid(reason: EvidenceProjectionValidationReason, ...issues: string[]): EvidenceProjectionValidationResult {
  return { valid: false, reason, issues };
}

function invalidRedaction(...issues: string[]): EvidenceRedactionDecisionValidationResult {
  return { valid: false, reason: "INVALID_REDACTION_DECISION", issues };
}

function classifyIssues(issues: string[]): EvidenceProjectionValidationReason {
  if (issues.some((issue) => issue.includes("timestamp"))) {
    return "INVALID_TIMESTAMP";
  }
  if (issues.some((issue) => issue.includes("non-negative integer"))) {
    return "INVALID_SIZE";
  }
  if (issues.some((issue) => issue.includes("must be one of"))) {
    return "INVALID_ENUM";
  }
  return "REQUIRED_FIELD_MISSING";
}

function requireString(record: Record<string, unknown>, key: string, issues: string[]): string {
  const value = record[key];
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  issues.push(`${key} must be a non-empty string`);
  return "";
}

function optionalString(value: unknown, key: string, issues: string[]): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  issues.push(`${key} must be a non-empty string when provided`);
  return null;
}

function requireIsoTimestamp(record: Record<string, unknown>, key: string, issues: string[]): string {
  const value = requireString(record, key, issues);
  if (value && Number.isNaN(new Date(value).getTime())) {
    issues.push(`${key} must be an ISO timestamp`);
  }
  return value;
}

function requireNonNegativeInteger(record: Record<string, unknown>, key: string, issues: string[]): number {
  const value = record[key];
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }
  issues.push(`${key} must be a non-negative integer`);
  return 0;
}

function requireEnum<T extends string>(
  record: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  issues: string[],
): T {
  const value = record[key];
  if (typeof value === "string" && allowed.includes(value as T)) {
    return value as T;
  }
  issues.push(`${key} must be one of ${allowed.join(", ")}`);
  return allowed[0];
}

function requireEvidenceFieldArray(record: Record<string, unknown>, key: string, issues: string[]): EvidenceField[] {
  const value = record[key];
  if (Array.isArray(value) && value.every(isEvidenceField)) {
    return [...value];
  }
  issues.push(`${key} must be an array of platform evidence field names`);
  return [];
}

function redact<T>(value: T, field: EvidenceField, redaction: EvidenceRedactionDecision): T | null {
  return redaction.fields_redacted.includes(field) ? null : value;
}

function cloneEvidenceRedactionDecision(redaction: EvidenceRedactionDecision): EvidenceRedactionDecision {
  return {
    profile: redaction.profile,
    fields_redacted: [...redaction.fields_redacted],
    storage_uri_exposed: false,
    reason: redaction.reason,
  };
}

function isEvidenceField(value: unknown): value is EvidenceField {
  return typeof value === "string" && EVIDENCE_FIELDS.includes(value as EvidenceField);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
