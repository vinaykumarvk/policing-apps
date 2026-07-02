export const PLATFORM_CASE_PROJECTION_SCHEMA_VERSION = "platform.case_projection.v1";

export type CaseClassificationLevel = "public" | "restricted" | "confidential" | "secret";
export type CaseSourceStatus =
  | "active"
  | "deleted"
  | "sealed"
  | "purged"
  | "superseded"
  | "retained_inaccessible"
  | "unknown";
export type CaseLegalHoldStatus = "none" | "active" | "released" | "unknown";
export type CaseRedactionProfile = "case-summary-v1" | "legal-review-v1" | "deny-none";
export type CaseRedactionReason = "case_summary" | "legal_review" | "deny_no_data_returned";

export type CaseField =
  | "case_id"
  | "source_system"
  | "source_record_id"
  | "case_number"
  | "title"
  | "summary"
  | "status"
  | "jurisdiction"
  | "assigned_unit_id"
  | "lead_investigator_id"
  | "subject_identifiers"
  | "legal_hold_status"
  | "classification"
  | "source_version"
  | "projection_version";

export interface PlatformCaseJurisdiction {
  country: string;
  state: string;
  district: string;
  police_station?: string;
}

export interface PlatformCaseProjection {
  schema_version: typeof PLATFORM_CASE_PROJECTION_SCHEMA_VERSION;
  case_id: string;
  source_system: string;
  source_record_id: string;
  case_number: string;
  title: string;
  summary: string;
  status: string;
  jurisdiction: PlatformCaseJurisdiction;
  assigned_unit_id: string;
  lead_investigator_id: string;
  subject_identifiers: string[];
  legal_hold_status: CaseLegalHoldStatus;
  classification: CaseClassificationLevel;
  source_version: string;
  projection_version: string;
  projected_at: string;
  source_status: CaseSourceStatus;
}

export interface CaseRedactionDecision {
  profile: CaseRedactionProfile;
  fields_redacted: CaseField[];
  storage_uri_exposed: false;
  reason: CaseRedactionReason;
}

export interface PlatformCaseReadModel {
  case_id: string | null;
  source_system: string | null;
  source_record_id: string | null;
  case_number: string | null;
  title: string | null;
  summary: string | null;
  status: string | null;
  jurisdiction: PlatformCaseJurisdiction | null;
  assigned_unit_id: string | null;
  lead_investigator_id: string | null;
  subject_identifiers: string[] | null;
  legal_hold_status: CaseLegalHoldStatus | null;
  classification: CaseClassificationLevel | null;
  source_version: string | null;
  projection_version: string | null;
  redaction_decision: CaseRedactionDecision;
}

export type CaseProjectionValidationReason =
  | "INPUT_NOT_OBJECT"
  | "UNSUPPORTED_SCHEMA_VERSION"
  | "REQUIRED_FIELD_MISSING"
  | "INVALID_ENUM"
  | "INVALID_TIMESTAMP"
  | "INVALID_ARRAY"
  | "INVALID_REDACTION_DECISION";

export type CaseProjectionValidationResult =
  | { valid: true; projection: PlatformCaseProjection; issues: [] }
  | { valid: false; reason: CaseProjectionValidationReason; issues: string[] };

export type CaseRedactionDecisionValidationResult =
  | { valid: true; decision: CaseRedactionDecision; issues: [] }
  | { valid: false; reason: "INVALID_REDACTION_DECISION"; issues: string[] };

export class CaseProjectionValidationError extends Error {
  readonly reason: CaseProjectionValidationReason;
  readonly issues: string[];

  constructor(reason: CaseProjectionValidationReason, issues: string[]) {
    super(`platform case projection is invalid: ${issues.join("; ")}`);
    this.name = "CaseProjectionValidationError";
    this.reason = reason;
    this.issues = [...issues];
  }
}

const CLASSIFICATION_LEVELS: readonly CaseClassificationLevel[] = ["public", "restricted", "confidential", "secret"];
const SOURCE_STATUSES: readonly CaseSourceStatus[] = [
  "active",
  "deleted",
  "sealed",
  "purged",
  "superseded",
  "retained_inaccessible",
  "unknown",
];
const LEGAL_HOLD_STATUSES: readonly CaseLegalHoldStatus[] = ["none", "active", "released", "unknown"];
const REDACTION_PROFILES: readonly CaseRedactionProfile[] = ["case-summary-v1", "legal-review-v1", "deny-none"];
const CASE_FIELDS: readonly CaseField[] = [
  "case_id",
  "source_system",
  "source_record_id",
  "case_number",
  "title",
  "summary",
  "status",
  "jurisdiction",
  "assigned_unit_id",
  "lead_investigator_id",
  "subject_identifiers",
  "legal_hold_status",
  "classification",
  "source_version",
  "projection_version",
];
const REDACTION_FIELDS_BY_PROFILE: Record<CaseRedactionProfile, readonly CaseField[]> = {
  "case-summary-v1": ["lead_investigator_id", "subject_identifiers", "legal_hold_status"],
  "legal-review-v1": ["subject_identifiers"],
  "deny-none": CASE_FIELDS,
};
const REDACTION_REASON_BY_PROFILE: Record<CaseRedactionProfile, CaseRedactionReason> = {
  "case-summary-v1": "case_summary",
  "legal-review-v1": "legal_review",
  "deny-none": "deny_no_data_returned",
};

export function validatePlatformCaseProjection(input: unknown): CaseProjectionValidationResult {
  if (!isRecord(input)) {
    return invalid("INPUT_NOT_OBJECT", "case projection must be an object");
  }

  const issues: string[] = [];
  const schemaVersion = requireString(input, "schema_version", issues);
  const caseId = requireString(input, "case_id", issues);
  const sourceSystem = requireString(input, "source_system", issues);
  const sourceRecordId = requireString(input, "source_record_id", issues);
  const caseNumber = requireString(input, "case_number", issues);
  const title = requireString(input, "title", issues);
  const summary = requireString(input, "summary", issues);
  const status = requireString(input, "status", issues);
  const jurisdiction = readJurisdiction(input.jurisdiction, issues);
  const assignedUnitId = requireString(input, "assigned_unit_id", issues);
  const leadInvestigatorId = requireString(input, "lead_investigator_id", issues);
  const subjectIdentifiers = requireStringArray(input, "subject_identifiers", issues);
  const legalHoldStatus = requireEnum(input, "legal_hold_status", LEGAL_HOLD_STATUSES, issues);
  const classification = requireEnum(input, "classification", CLASSIFICATION_LEVELS, issues);
  const sourceVersion = requireString(input, "source_version", issues);
  const projectionVersion = requireString(input, "projection_version", issues);
  const projectedAt = requireIsoTimestamp(input, "projected_at", issues);
  const sourceStatus = requireEnum(input, "source_status", SOURCE_STATUSES, issues);

  if (issues.length > 0) {
    return invalid(classifyIssues(issues), ...issues);
  }

  if (schemaVersion !== PLATFORM_CASE_PROJECTION_SCHEMA_VERSION) {
    return invalid("UNSUPPORTED_SCHEMA_VERSION", `unsupported schema_version ${schemaVersion}`);
  }

  return {
    valid: true,
    projection: {
      schema_version: PLATFORM_CASE_PROJECTION_SCHEMA_VERSION,
      case_id: caseId,
      source_system: sourceSystem,
      source_record_id: sourceRecordId,
      case_number: caseNumber,
      title,
      summary,
      status,
      jurisdiction,
      assigned_unit_id: assignedUnitId,
      lead_investigator_id: leadInvestigatorId,
      subject_identifiers: subjectIdentifiers,
      legal_hold_status: legalHoldStatus,
      classification,
      source_version: sourceVersion,
      projection_version: projectionVersion,
      projected_at: projectedAt,
      source_status: sourceStatus,
    },
    issues: [],
  };
}

export function createCaseRedactionDecision(profile: CaseRedactionProfile): CaseRedactionDecision {
  return {
    profile,
    fields_redacted: [...REDACTION_FIELDS_BY_PROFILE[profile]],
    storage_uri_exposed: false,
    reason: REDACTION_REASON_BY_PROFILE[profile],
  };
}

export function validateCaseRedactionDecision(input: unknown): CaseRedactionDecisionValidationResult {
  if (!isRecord(input)) {
    return invalidRedaction("redaction decision must be an object");
  }

  const issues: string[] = [];
  const profile = requireEnum(input, "profile", REDACTION_PROFILES, issues);
  const fieldsRedacted = requireCaseFieldArray(input, "fields_redacted", issues);
  if (input.storage_uri_exposed !== false) {
    issues.push("storage_uri_exposed must be false for platform case responses");
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

export function toPlatformCaseReadModel(input: unknown, redaction: CaseRedactionDecision): PlatformCaseReadModel {
  const validation = validatePlatformCaseProjection(input);
  if (!validation.valid) {
    throw new CaseProjectionValidationError(validation.reason, validation.issues);
  }

  const redactionValidation = validateCaseRedactionDecision(redaction);
  if (!redactionValidation.valid) {
    throw new CaseProjectionValidationError(redactionValidation.reason, redactionValidation.issues);
  }

  const projection = validation.projection;
  return {
    case_id: redact(projection.case_id, "case_id", redaction),
    source_system: redact(projection.source_system, "source_system", redaction),
    source_record_id: redact(projection.source_record_id, "source_record_id", redaction),
    case_number: redact(projection.case_number, "case_number", redaction),
    title: redact(projection.title, "title", redaction),
    summary: redact(projection.summary, "summary", redaction),
    status: redact(projection.status, "status", redaction),
    jurisdiction: redact({ ...projection.jurisdiction }, "jurisdiction", redaction),
    assigned_unit_id: redact(projection.assigned_unit_id, "assigned_unit_id", redaction),
    lead_investigator_id: redact(projection.lead_investigator_id, "lead_investigator_id", redaction),
    subject_identifiers: redact([...projection.subject_identifiers], "subject_identifiers", redaction),
    legal_hold_status: redact(projection.legal_hold_status, "legal_hold_status", redaction),
    classification: redact(projection.classification, "classification", redaction),
    source_version: redact(projection.source_version, "source_version", redaction),
    projection_version: redact(projection.projection_version, "projection_version", redaction),
    redaction_decision: cloneCaseRedactionDecision(redaction),
  };
}

function invalid(reason: CaseProjectionValidationReason, ...issues: string[]): CaseProjectionValidationResult {
  return { valid: false, reason, issues };
}

function invalidRedaction(...issues: string[]): CaseRedactionDecisionValidationResult {
  return { valid: false, reason: "INVALID_REDACTION_DECISION", issues };
}

function classifyIssues(issues: string[]): CaseProjectionValidationReason {
  if (issues.some((issue) => issue.includes("timestamp"))) {
    return "INVALID_TIMESTAMP";
  }
  if (issues.some((issue) => issue.includes("must be one of"))) {
    return "INVALID_ENUM";
  }
  if (issues.some((issue) => issue.includes("array"))) {
    return "INVALID_ARRAY";
  }
  return "REQUIRED_FIELD_MISSING";
}

function readJurisdiction(input: unknown, issues: string[]): PlatformCaseJurisdiction {
  if (!isRecord(input)) {
    issues.push("jurisdiction must be an object");
    return { country: "", state: "", district: "" };
  }

  return {
    country: requireNamedString(input.country, "jurisdiction.country", issues),
    state: requireNamedString(input.state, "jurisdiction.state", issues),
    district: requireNamedString(input.district, "jurisdiction.district", issues),
    police_station: optionalString(input.police_station, "jurisdiction.police_station", issues),
  };
}

function requireString(record: Record<string, unknown>, key: string, issues: string[]): string {
  const value = key.includes(".") ? nestedValue(record, key) : record[key];
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  issues.push(`${key} must be a non-empty string`);
  return "";
}

function requireNamedString(value: unknown, key: string, issues: string[]): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  issues.push(`${key} must be a non-empty string`);
  return "";
}

function optionalString(value: unknown, key: string, issues: string[]): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  issues.push(`${key} must be a non-empty string when provided`);
  return undefined;
}

function requireIsoTimestamp(record: Record<string, unknown>, key: string, issues: string[]): string {
  const value = requireString(record, key, issues);
  if (value && Number.isNaN(new Date(value).getTime())) {
    issues.push(`${key} must be an ISO timestamp`);
  }
  return value;
}

function requireStringArray(record: Record<string, unknown>, key: string, issues: string[]): string[] {
  const value = record[key];
  if (Array.isArray(value) && value.every(isNonEmptyString)) {
    return [...value];
  }
  issues.push(`${key} must be an array of non-empty strings`);
  return [];
}

function requireCaseFieldArray(record: Record<string, unknown>, key: string, issues: string[]): CaseField[] {
  const value = record[key];
  if (Array.isArray(value) && value.every(isCaseField)) {
    return [...value];
  }
  issues.push(`${key} must be an array of platform case field names`);
  return [];
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

function redact<T>(value: T, field: CaseField, redaction: CaseRedactionDecision): T | null {
  return redaction.fields_redacted.includes(field) ? null : value;
}

function cloneCaseRedactionDecision(redaction: CaseRedactionDecision): CaseRedactionDecision {
  return {
    profile: redaction.profile,
    fields_redacted: [...redaction.fields_redacted],
    storage_uri_exposed: false,
    reason: redaction.reason,
  };
}

function nestedValue(record: Record<string, unknown>, key: string): unknown {
  return key.split(".").reduce<unknown>((current, segment) => {
    if (!isRecord(current)) {
      return undefined;
    }
    return current[segment];
  }, record);
}

function isCaseField(value: unknown): value is CaseField {
  return typeof value === "string" && CASE_FIELDS.includes(value as CaseField);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
