export const PLATFORM_CLAIMS_SCHEMA_VERSION = "platform.claims.v1";
export const DEFAULT_MAX_CLAIM_AGE_SECONDS = 15 * 60;

export type ClearanceLevel = "public" | "restricted" | "confidential" | "secret";

export type ClaimRejectionReason =
  | "CLAIM_MISSING"
  | "CLAIM_MALFORMED"
  | "CLAIM_UNSUPPORTED_VERSION"
  | "CLAIM_EXPIRED"
  | "CLAIM_STALE"
  | "CLAIM_INCOMPATIBLE_SOURCE"
  | "CLAIM_AMBIGUOUS";

export interface PlatformSubject {
  user_id: string;
  persona: string;
  display_name: string;
  tenant_id: string;
  org_id: string;
}

export interface DomainPermissionClaim {
  domain: string;
  permissions: string[];
}

export interface OrgScopeClaim {
  tenant_id: string;
  org_id: string;
  unit_ids: string[];
  scope: string;
}

export interface JurisdictionClaim {
  country: string;
  state: string;
  districts: string[];
  police_stations: string[];
  scope: "station" | "district" | "state" | "national";
}

export interface ClearanceClaim {
  level: ClearanceLevel;
  compartments: string[];
}

export interface AssignmentClaim {
  case_ids: string[];
  queue_ids: string[];
  evidence_ids: string[];
  jurisdiction_wide: boolean;
  domain_wide: boolean;
}

export interface PurposeClaim {
  allowed: string[];
}

export interface MfaClaim {
  required: boolean;
  verified: boolean;
  methods: string[];
  verified_at: string | null;
}

export interface PlatformClaims {
  schema_version: string;
  claim_version: number;
  source: string;
  source_version: string;
  subject: PlatformSubject;
  issued_at: string;
  expires_at: string;
  session_id: string;
  modules: string[];
  domain_permissions: DomainPermissionClaim[];
  org: OrgScopeClaim;
  jurisdiction: JurisdictionClaim;
  clearance: ClearanceClaim;
  assignment: AssignmentClaim;
  purpose: PurposeClaim;
  mfa: MfaClaim;
}

export interface ClaimValidationOptions {
  now?: Date | string;
  maxAgeSeconds?: number;
  expectedSourceVersion?: string;
}

export type ClaimValidationResult =
  | { valid: true; claims: PlatformClaims; issues: [] }
  | { valid: false; reason: ClaimRejectionReason; issues: string[] };

export interface PlatformClaimSnapshot {
  schema_version: string;
  claim_version: number;
  source_version: string;
  subject_id: string;
  persona: string;
  session_id: string;
  modules: string[];
  domain_permissions: DomainPermissionClaim[];
  org: OrgScopeClaim;
  jurisdiction: JurisdictionClaim;
  clearance: ClearanceClaim;
  assignment: AssignmentClaim;
  purpose: PurposeClaim;
  mfa_verified: boolean;
  expires_at: string;
}

const CLEARANCE_ORDER: ClearanceLevel[] = ["public", "restricted", "confidential", "secret"];
const JURISDICTION_SCOPES = ["station", "district", "state", "national"];

export function clearanceRank(level: ClearanceLevel): number {
  return CLEARANCE_ORDER.indexOf(level);
}

export function validatePlatformClaims(
  input: unknown,
  options: ClaimValidationOptions = {},
): ClaimValidationResult {
  if (!isRecord(input)) {
    return invalid("CLAIM_MISSING", "claim must be an object");
  }

  const issues: string[] = [];
  const schemaVersion = requireString(input, "schema_version", issues);
  const claimVersion = requireInteger(input, "claim_version", issues);
  const source = requireString(input, "source", issues);
  const sourceVersion = requireString(input, "source_version", issues);
  const issuedAt = requireString(input, "issued_at", issues);
  const expiresAt = requireString(input, "expires_at", issues);
  const sessionId = requireString(input, "session_id", issues);
  const modules = requireStringArray(input, "modules", issues);
  const subject = readSubject(input.subject, issues);
  const domainPermissions = readDomainPermissions(input.domain_permissions, issues);
  const org = readOrg(input.org, issues);
  const jurisdiction = readJurisdiction(input.jurisdiction, issues);
  const clearance = readClearance(input.clearance, issues);
  const assignment = readAssignment(input.assignment, issues);
  const purpose = readPurpose(input.purpose, issues);
  const mfa = readMfa(input.mfa, issues);

  if (issues.length > 0) {
    return invalid("CLAIM_MALFORMED", ...issues);
  }

  const claims: PlatformClaims = {
    schema_version: schemaVersion,
    claim_version: claimVersion,
    source,
    source_version: sourceVersion,
    subject,
    issued_at: issuedAt,
    expires_at: expiresAt,
    session_id: sessionId,
    modules,
    domain_permissions: domainPermissions,
    org,
    jurisdiction,
    clearance,
    assignment,
    purpose,
    mfa,
  };

  if (claims.schema_version !== PLATFORM_CLAIMS_SCHEMA_VERSION) {
    return invalid("CLAIM_UNSUPPORTED_VERSION", `unsupported schema_version ${claims.schema_version}`);
  }

  if (options.expectedSourceVersion && claims.source_version !== options.expectedSourceVersion) {
    return invalid("CLAIM_INCOMPATIBLE_SOURCE", `expected source_version ${options.expectedSourceVersion}`);
  }

  const ambiguityIssues = findAmbiguityIssues(claims);
  if (ambiguityIssues.length > 0) {
    return invalid("CLAIM_AMBIGUOUS", ...ambiguityIssues);
  }

  const now = toDate(options.now ?? new Date());
  const issued = toDate(claims.issued_at);
  const expires = toDate(claims.expires_at);
  if (!now || !issued || !expires) {
    return invalid("CLAIM_MALFORMED", "issued_at and expires_at must be valid ISO timestamps");
  }

  if (expires.getTime() <= now.getTime()) {
    return invalid("CLAIM_EXPIRED", "claim has expired");
  }

  if (issued.getTime() > now.getTime()) {
    return invalid("CLAIM_STALE", "claim issued_at is in the future");
  }

  const maxAgeMs = (options.maxAgeSeconds ?? DEFAULT_MAX_CLAIM_AGE_SECONDS) * 1000;
  if (now.getTime() - issued.getTime() > maxAgeMs) {
    return invalid("CLAIM_STALE", "claim issued_at is older than maxAgeSeconds");
  }

  return { valid: true, claims, issues: [] };
}

export function claimEvidenceSnapshot(claims: PlatformClaims): PlatformClaimSnapshot {
  return {
    schema_version: claims.schema_version,
    claim_version: claims.claim_version,
    source_version: claims.source_version,
    subject_id: claims.subject.user_id,
    persona: claims.subject.persona,
    session_id: claims.session_id,
    modules: [...claims.modules],
    domain_permissions: claims.domain_permissions.map((entry) => ({
      domain: entry.domain,
      permissions: [...entry.permissions],
    })),
    org: {
      ...claims.org,
      unit_ids: [...claims.org.unit_ids],
    },
    jurisdiction: {
      ...claims.jurisdiction,
      districts: [...claims.jurisdiction.districts],
      police_stations: [...claims.jurisdiction.police_stations],
    },
    clearance: {
      ...claims.clearance,
      compartments: [...claims.clearance.compartments],
    },
    assignment: {
      case_ids: [...claims.assignment.case_ids],
      queue_ids: [...claims.assignment.queue_ids],
      evidence_ids: [...claims.assignment.evidence_ids],
      jurisdiction_wide: claims.assignment.jurisdiction_wide,
      domain_wide: claims.assignment.domain_wide,
    },
    purpose: {
      allowed: [...claims.purpose.allowed],
    },
    mfa_verified: claims.mfa.verified,
    expires_at: claims.expires_at,
  };
}

function invalid(reason: ClaimRejectionReason, ...issues: string[]): ClaimValidationResult {
  return { valid: false, reason, issues };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(record: Record<string, unknown>, key: string, issues: string[]): string {
  const value = record[key];
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  issues.push(`${key} must be a non-empty string`);
  return "";
}

function requireNullableString(record: Record<string, unknown>, key: string, issues: string[]): string | null {
  const value = record[key];
  if (value === null) {
    return null;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  issues.push(`${key} must be null or a non-empty string`);
  return null;
}

function requireInteger(record: Record<string, unknown>, key: string, issues: string[]): number {
  const value = record[key];
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }
  issues.push(`${key} must be a positive integer`);
  return 0;
}

function requireBoolean(record: Record<string, unknown>, key: string, issues: string[]): boolean {
  const value = record[key];
  if (typeof value === "boolean") {
    return value;
  }
  issues.push(`${key} must be a boolean`);
  return false;
}

function requireStringArray(record: Record<string, unknown>, key: string, issues: string[]): string[] {
  const value = record[key];
  if (Array.isArray(value) && value.every((item) => typeof item === "string" && item.trim().length > 0)) {
    return [...value];
  }
  issues.push(`${key} must be an array of non-empty strings`);
  return [];
}

function readSubject(value: unknown, issues: string[]): PlatformSubject {
  if (!isRecord(value)) {
    issues.push("subject must be an object");
    return emptySubject();
  }
  return {
    user_id: requireString(value, "user_id", issues),
    persona: requireString(value, "persona", issues),
    display_name: requireString(value, "display_name", issues),
    tenant_id: requireString(value, "tenant_id", issues),
    org_id: requireString(value, "org_id", issues),
  };
}

function readDomainPermissions(value: unknown, issues: string[]): DomainPermissionClaim[] {
  if (!Array.isArray(value) || value.length === 0) {
    issues.push("domain_permissions must be a non-empty array");
    return [];
  }

  return value.map((entry, index) => {
    if (!isRecord(entry)) {
      issues.push(`domain_permissions[${index}] must be an object`);
      return { domain: "", permissions: [] };
    }
    return {
      domain: requireString(entry, "domain", issues),
      permissions: requireStringArray(entry, "permissions", issues),
    };
  });
}

function readOrg(value: unknown, issues: string[]): OrgScopeClaim {
  if (!isRecord(value)) {
    issues.push("org must be an object");
    return { tenant_id: "", org_id: "", unit_ids: [], scope: "" };
  }
  return {
    tenant_id: requireString(value, "tenant_id", issues),
    org_id: requireString(value, "org_id", issues),
    unit_ids: requireStringArray(value, "unit_ids", issues),
    scope: requireString(value, "scope", issues),
  };
}

function readJurisdiction(value: unknown, issues: string[]): JurisdictionClaim {
  if (!isRecord(value)) {
    issues.push("jurisdiction must be an object");
    return { country: "", state: "", districts: [], police_stations: [], scope: "station" };
  }

  const scope = requireString(value, "scope", issues);
  if (!isJurisdictionScope(scope)) {
    issues.push("jurisdiction.scope must be station, district, state, or national");
  }

  return {
    country: requireString(value, "country", issues),
    state: requireString(value, "state", issues),
    districts: readOptionalStringArray(value, "districts", issues),
    police_stations: readOptionalStringArray(value, "police_stations", issues),
    scope: isJurisdictionScope(scope) ? scope : "station",
  };
}

function readClearance(value: unknown, issues: string[]): ClearanceClaim {
  if (!isRecord(value)) {
    issues.push("clearance must be an object");
    return { level: "public", compartments: [] };
  }

  const level = requireString(value, "level", issues);
  if (!isClearanceLevel(level)) {
    issues.push("clearance.level must be public, restricted, confidential, or secret");
  }

  return {
    level: isClearanceLevel(level) ? level : "public",
    compartments: readOptionalStringArray(value, "compartments", issues),
  };
}

function readAssignment(value: unknown, issues: string[]): AssignmentClaim {
  if (!isRecord(value)) {
    issues.push("assignment must be an object");
    return { case_ids: [], queue_ids: [], evidence_ids: [], jurisdiction_wide: false, domain_wide: false };
  }
  return {
    case_ids: readOptionalStringArray(value, "case_ids", issues),
    queue_ids: readOptionalStringArray(value, "queue_ids", issues),
    evidence_ids: readOptionalStringArray(value, "evidence_ids", issues),
    jurisdiction_wide: requireBoolean(value, "jurisdiction_wide", issues),
    domain_wide: requireBoolean(value, "domain_wide", issues),
  };
}

function readPurpose(value: unknown, issues: string[]): PurposeClaim {
  if (!isRecord(value)) {
    issues.push("purpose must be an object");
    return { allowed: [] };
  }
  return {
    allowed: requireStringArray(value, "allowed", issues),
  };
}

function readMfa(value: unknown, issues: string[]): MfaClaim {
  if (!isRecord(value)) {
    issues.push("mfa must be an object");
    return { required: false, verified: false, methods: [], verified_at: null };
  }
  return {
    required: requireBoolean(value, "required", issues),
    verified: requireBoolean(value, "verified", issues),
    methods: readOptionalStringArray(value, "methods", issues),
    verified_at: requireNullableString(value, "verified_at", issues),
  };
}

function readOptionalStringArray(record: Record<string, unknown>, key: string, issues: string[]): string[] {
  const value = record[key];
  if (Array.isArray(value) && value.every((item) => typeof item === "string" && item.trim().length > 0)) {
    return [...value];
  }
  issues.push(`${key} must be an array of non-empty strings`);
  return [];
}

function findAmbiguityIssues(claims: PlatformClaims): string[] {
  const issues: string[] = [];
  appendDuplicateIssue(issues, claims.modules, "modules");
  appendDuplicateIssue(issues, claims.domain_permissions.map((entry) => entry.domain), "domain_permissions.domain");
  claims.domain_permissions.forEach((entry) => appendDuplicateIssue(issues, entry.permissions, `${entry.domain}.permissions`));
  appendDuplicateIssue(issues, claims.org.unit_ids, "org.unit_ids");
  appendDuplicateIssue(issues, claims.jurisdiction.districts, "jurisdiction.districts");
  appendDuplicateIssue(issues, claims.jurisdiction.police_stations, "jurisdiction.police_stations");
  appendDuplicateIssue(issues, claims.assignment.case_ids, "assignment.case_ids");
  appendDuplicateIssue(issues, claims.assignment.queue_ids, "assignment.queue_ids");
  appendDuplicateIssue(issues, claims.assignment.evidence_ids, "assignment.evidence_ids");
  appendDuplicateIssue(issues, claims.purpose.allowed, "purpose.allowed");
  appendDuplicateIssue(issues, claims.mfa.methods, "mfa.methods");
  return issues;
}

function appendDuplicateIssue(issues: string[], values: string[], label: string): void {
  const seen = new Set<string>();
  values.forEach((value) => {
    if (seen.has(value)) {
      issues.push(`${label} contains duplicate value ${value}`);
    }
    seen.add(value);
  });
}

function emptySubject(): PlatformSubject {
  return { user_id: "", persona: "", display_name: "", tenant_id: "", org_id: "" };
}

function isClearanceLevel(value: string): value is ClearanceLevel {
  return CLEARANCE_ORDER.includes(value as ClearanceLevel);
}

function isJurisdictionScope(value: string): value is JurisdictionClaim["scope"] {
  return JURISDICTION_SCOPES.includes(value);
}

function toDate(value: Date | string): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
