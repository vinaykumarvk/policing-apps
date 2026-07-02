import casesFixture from "../../../../fixtures/platform/cases.json";
import {
  type AbacDecision,
  type AbacOptions,
  type AbacRequest,
  type AbacResourceContext,
  type RedactionDecision,
  evaluateAbac,
} from "../../../../packages/authz/src";
import {
  PLATFORM_CASE_PROJECTION_SCHEMA_VERSION,
  type CaseClassificationLevel,
  type CaseField,
  type CaseLegalHoldStatus,
  type CaseRedactionDecision,
  type CaseSourceStatus,
  type PlatformCaseJurisdiction,
  type PlatformCaseProjection,
  type PlatformCaseReadModel,
  toPlatformCaseReadModel,
  validateCaseRedactionDecision,
  validatePlatformCaseProjection,
} from "../../../../packages/case-core/src";

export const CASE_PROJECTION_SERVICE_VERSION = "platform.case_projection.service.v1";
export const DEFAULT_CASE_PROJECTION_TTL_SECONDS = 300;
export const DEFAULT_CASE360_PURPOSE = "case_review";

export interface CaseProjectionReadInput {
  claimInput: unknown;
  serverVerified: boolean;
  correlationId: string;
  path?: string;
  now?: Date | string;
  expectedSourceVersion?: string;
  projectionMaxAgeSeconds?: number;
  purpose?: string;
}

export interface PlatformCaseProjectionRecord {
  projection: PlatformCaseProjection;
  org_id: string;
  unit_id?: string;
  assignment: CaseProjectionAssignment;
  linked_case_ids: string[];
  field_classification: Record<CaseField, CaseClassificationLevel>;
  redaction_decision: CaseRedactionDecision;
  retention_status: CaseRetentionStatus;
  projection_ttl_seconds: number;
  source_authoritative: true;
}

export interface PlatformCaseLinkRecord {
  link_id: string;
  left_case_id: string;
  right_case_id: string;
  link_type: string;
  source_version: string;
  projection_version: string;
  projected_at: string;
  projection_ttl_seconds: number;
  source_authoritative: true;
}

export type CaseRetentionStatus = "active" | "hold" | "archive_due" | "purge_due" | "retained_inaccessible" | "unknown";

export interface CaseProjectionAssignment {
  case_id?: string;
  queue_id?: string;
  evidence_id?: string;
}

export type CaseProjectionReadResult =
  | {
      status: "allowed";
      case_id: string;
      record: PlatformCaseProjectionRecord;
      decision: Extract<AbacDecision, { allowed: true }>;
      read_model: PlatformCaseReadModel;
    }
  | {
      status: "denied";
      case_id: string;
      record: PlatformCaseProjectionRecord;
      decision: Exclude<AbacDecision, { allowed: true }>;
    }
  | {
      status: "missing";
      case_id: string;
      decision: Exclude<AbacDecision, { allowed: true }>;
    };

export interface CaseProjectionService {
  getCase: (caseId: string) => PlatformCaseProjectionRecord | null;
  listLinkedCases: (caseId: string) => PlatformCaseProjectionRecord[];
  listCaseIdsFor360: (caseId: string) => string[];
  readCase: (caseId: string, input: CaseProjectionReadInput) => CaseProjectionReadResult;
}

export interface CaseProjectionServiceOptions {
  records?: readonly PlatformCaseProjectionRecord[];
  links?: readonly PlatformCaseLinkRecord[];
  projectionTtlSeconds?: number;
}

interface PilotCasesFixture {
  cases: PilotCaseFixture[];
  case_links: PilotCaseLinkFixture[];
}

interface PilotCaseFixture {
  case_id: string;
  source_system: string;
  source_record_id: string;
  case_number: string;
  linked_case_ids: string[];
  title: string;
  summary: string;
  status: string;
  source_status: string;
  resource_classification: string;
  legal_hold_status: string;
  source_version: string;
  projection_version: string;
  projected_at: string;
  org_id: string;
  unit_id: string;
  jurisdiction: PlatformCaseJurisdiction;
  assignment: CaseProjectionAssignment;
  field_classification: Record<string, string>;
  default_redaction_decision: {
    profile: string;
    fields_redacted: string[];
    storage_uri_exposed: boolean;
    reason: string;
  };
  retention_status?: string;
}

interface PilotCaseLinkFixture {
  link_id: string;
  left_case_id: string;
  right_case_id: string;
  link_type: string;
  source_version: string;
  projection_version: string;
  projected_at?: string;
  projection_ttl_seconds?: number;
}

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

const CLASSIFICATIONS: readonly CaseClassificationLevel[] = ["public", "restricted", "confidential", "secret"];
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
const RETENTION_STATUSES: readonly CaseRetentionStatus[] = [
  "active",
  "hold",
  "archive_due",
  "purge_due",
  "retained_inaccessible",
  "unknown",
];

export function createCaseProjectionService(options: CaseProjectionServiceOptions = {}): CaseProjectionService {
  const projectionTtlSeconds = options.projectionTtlSeconds ?? DEFAULT_CASE_PROJECTION_TTL_SECONDS;
  const records = options.records ?? recordsFromFixture(projectionTtlSeconds);
  const links = options.links ?? linksFromFixture(projectionTtlSeconds);
  const recordById = new Map(records.map((record) => [record.projection.case_id, cloneCaseRecord(record)]));
  const linkRecords = links.map(cloneLinkRecord);

  return {
    getCase: (caseId) => {
      const record = recordById.get(caseId);
      return record ? cloneCaseRecord(record) : null;
    },
    listLinkedCases: (caseId) =>
      linkedCaseIds(caseId, linkRecords)
        .map((linkedCaseId) => recordById.get(linkedCaseId))
        .filter(isCaseRecord)
        .map(cloneCaseRecord),
    listCaseIdsFor360: (caseId) => [caseId, ...linkedCaseIds(caseId, linkRecords)],
    readCase: (caseId, input) => readCase(caseId, input, recordById),
  };
}

export function recordsFromFixture(projectionTtlSeconds = DEFAULT_CASE_PROJECTION_TTL_SECONDS): PlatformCaseProjectionRecord[] {
  const fixture = casesFixture as PilotCasesFixture;
  return fixture.cases.map((entry) => recordFromFixture(entry, projectionTtlSeconds));
}

export function linksFromFixture(projectionTtlSeconds = DEFAULT_CASE_PROJECTION_TTL_SECONDS): PlatformCaseLinkRecord[] {
  const fixture = casesFixture as PilotCasesFixture;
  return fixture.case_links.map((entry) => ({
    link_id: entry.link_id,
    left_case_id: entry.left_case_id,
    right_case_id: entry.right_case_id,
    link_type: entry.link_type,
    source_version: entry.source_version,
    projection_version: entry.projection_version,
    projected_at: entry.projected_at ?? "2026-07-01T18:44:30Z",
    projection_ttl_seconds: entry.projection_ttl_seconds ?? projectionTtlSeconds,
    source_authoritative: true,
  }));
}

function readCase(
  caseId: string,
  input: CaseProjectionReadInput,
  recordById: ReadonlyMap<string, PlatformCaseProjectionRecord>,
): CaseProjectionReadResult {
  const record = recordById.get(caseId);
  if (!record) {
    const decision = evaluateAbac(input.claimInput, missingCaseRequest(caseId, input), abacOptions(input));
    return { status: "missing", case_id: caseId, decision: denyDecision(decision) };
  }

  const request = caseReadRequest(record, input);
  const decision = evaluateAbac(input.claimInput, request, abacOptions(input, record.projection_ttl_seconds));
  if (!decision.allowed) {
    return { status: "denied", case_id: caseId, record: cloneCaseRecord(record), decision };
  }

  return {
    status: "allowed",
    case_id: caseId,
    record: cloneCaseRecord(record),
    decision,
    read_model: toPlatformCaseReadModel(record.projection, record.redaction_decision),
  };
}

function recordFromFixture(entry: PilotCaseFixture, projectionTtlSeconds: number): PlatformCaseProjectionRecord {
  const classification = classificationFromString(entry.resource_classification);
  const projection: PlatformCaseProjection = {
    schema_version: PLATFORM_CASE_PROJECTION_SCHEMA_VERSION,
    case_id: entry.case_id,
    source_system: entry.source_system,
    source_record_id: entry.source_record_id,
    case_number: entry.case_number,
    title: entry.title,
    summary: entry.summary,
    status: entry.status,
    jurisdiction: cloneJurisdiction(entry.jurisdiction),
    assigned_unit_id: entry.unit_id,
    lead_investigator_id: syntheticLeadInvestigatorId(entry),
    subject_identifiers: [],
    legal_hold_status: legalHoldFromString(entry.legal_hold_status),
    classification,
    source_version: entry.source_version,
    projection_version: entry.projection_version,
    projected_at: entry.projected_at,
    source_status: sourceStatusFromString(entry.source_status),
  };

  const validation = validatePlatformCaseProjection(projection);
  if (!validation.valid) {
    throw new Error(`invalid pilot case projection ${entry.case_id}: ${validation.issues.join("; ")}`);
  }

  const redactionDecision = caseRedactionDecision(entry.default_redaction_decision.fields_redacted);
  const redactionValidation = validateCaseRedactionDecision(redactionDecision);
  if (!redactionValidation.valid) {
    throw new Error(`invalid pilot case redaction ${entry.case_id}: ${redactionValidation.issues.join("; ")}`);
  }

  return {
    projection,
    org_id: entry.org_id,
    unit_id: entry.unit_id,
    assignment: cloneAssignment(entry.assignment),
    linked_case_ids: [...entry.linked_case_ids],
    field_classification: fieldClassifications(entry.field_classification),
    redaction_decision: redactionDecision,
    retention_status: retentionStatusFromString(entry.retention_status ?? "active"),
    projection_ttl_seconds: projectionTtlSeconds,
    source_authoritative: true,
  };
}

function caseReadRequest(record: PlatformCaseProjectionRecord, input: CaseProjectionReadInput): AbacRequest {
  const projection = record.projection;
  return {
    action: "platform.case.read",
    path: input.path ?? `/api/v1/platform/cases/${projection.case_id}`,
    correlation_id: input.correlationId,
    module: projection.source_system,
    domain: projection.source_system,
    permission: casePermission(projection.source_system),
    purpose: input.purpose ?? DEFAULT_CASE360_PURPOSE,
    require_mfa: true,
    server_verified: input.serverVerified,
    resource: {
      kind: "platform_case",
      resource_id: projection.case_id,
      source_system: projection.source_system,
      source_record_id: projection.source_record_id,
      source_version: projection.source_version,
      projection_version: projection.projection_version,
      projected_at: projection.projected_at,
      source_status: effectiveSourceStatus(record),
      classification: projection.classification,
      org_id: record.org_id,
      unit_id: record.unit_id,
      jurisdiction: cloneJurisdiction(projection.jurisdiction),
      assignment: cloneAssignment(record.assignment),
      legal_hold_status: projection.legal_hold_status,
    },
    redaction_decision: abacRedaction(record.redaction_decision),
  };
}

function missingCaseRequest(caseId: string, input: CaseProjectionReadInput): AbacRequest {
  return {
    action: "platform.case.read",
    path: input.path ?? `/api/v1/platform/cases/${caseId}`,
    correlation_id: input.correlationId,
    module: "platform",
    domain: "platform",
    permission: "case:read",
    purpose: input.purpose ?? DEFAULT_CASE360_PURPOSE,
    require_mfa: true,
    server_verified: input.serverVerified,
    resource: missingResource(caseId),
    redaction_decision: denyRedaction(),
  };
}

function missingResource(caseId: string): AbacResourceContext {
  return {
    kind: "platform_case",
    resource_id: caseId,
    source_system: "missing",
    source_record_id: "missing",
    source_version: null,
    projection_version: null,
    projected_at: null,
    source_status: "unknown",
    classification: "restricted",
    org_id: "missing",
    jurisdiction: {
      country: "missing",
      state: "missing",
    },
    assignment: { case_id: caseId },
    legal_hold_status: "unknown",
  };
}

function abacOptions(input: CaseProjectionReadInput, ttlSeconds?: number): AbacOptions {
  return {
    now: input.now,
    expectedSourceVersion: input.expectedSourceVersion,
    projectionMaxAgeSeconds: input.projectionMaxAgeSeconds ?? ttlSeconds ?? DEFAULT_CASE_PROJECTION_TTL_SECONDS,
  };
}

function casePermission(sourceSystem: string): string {
  return sourceSystem === "iqw" ? "complaint:read" : "case:read";
}

function effectiveSourceStatus(record: PlatformCaseProjectionRecord): CaseSourceStatus {
  if (record.projection.source_status !== "active") {
    return record.projection.source_status;
  }
  if (record.retention_status === "purge_due" || record.retention_status === "retained_inaccessible") {
    return "retained_inaccessible";
  }
  return "active";
}

function caseRedactionDecision(fields: readonly string[]): CaseRedactionDecision {
  const normalized = normalizeCaseFields(fields.length > 0 ? fields : ["subject_identifiers"]);
  return {
    profile: "case-summary-v1",
    fields_redacted: normalized,
    storage_uri_exposed: false,
    reason: "case_summary",
  };
}

function denyRedaction(): RedactionDecision {
  return {
    profile: "deny-none",
    fields_redacted: [...CASE_FIELDS],
    storage_uri_exposed: false,
    reason: "deny_no_data_returned",
  };
}

function abacRedaction(redaction: CaseRedactionDecision): RedactionDecision {
  return {
    profile: redaction.profile,
    fields_redacted: [...redaction.fields_redacted],
    storage_uri_exposed: false,
    reason: redaction.reason,
  };
}

function linkedCaseIds(caseId: string, links: readonly PlatformCaseLinkRecord[]): string[] {
  const ids = links.flatMap((link) => {
    if (link.left_case_id === caseId) {
      return [link.right_case_id];
    }
    if (link.right_case_id === caseId) {
      return [link.left_case_id];
    }
    return [];
  });
  return [...new Set(ids)];
}

function fieldClassifications(input: Record<string, string>): Record<CaseField, CaseClassificationLevel> {
  const entries = CASE_FIELDS.map((field) => [field, classificationFromString(input[field] ?? "secret")] as const);
  return Object.fromEntries(entries) as Record<CaseField, CaseClassificationLevel>;
}

function normalizeCaseFields(fields: readonly string[]): CaseField[] {
  const normalized = fields.filter(isCaseField);
  return normalized.length > 0 ? [...new Set(normalized)] : ["subject_identifiers"];
}

function sourceStatusFromString(value: string): CaseSourceStatus {
  return SOURCE_STATUSES.includes(value as CaseSourceStatus) ? (value as CaseSourceStatus) : "unknown";
}

function legalHoldFromString(value: string): CaseLegalHoldStatus {
  return LEGAL_HOLD_STATUSES.includes(value as CaseLegalHoldStatus) ? (value as CaseLegalHoldStatus) : "unknown";
}

function retentionStatusFromString(value: string): CaseRetentionStatus {
  return RETENTION_STATUSES.includes(value as CaseRetentionStatus) ? (value as CaseRetentionStatus) : "unknown";
}

function classificationFromString(value: string): CaseClassificationLevel {
  return CLASSIFICATIONS.includes(value as CaseClassificationLevel) ? (value as CaseClassificationLevel) : "secret";
}

function syntheticLeadInvestigatorId(entry: PilotCaseFixture): string {
  if (entry.source_system === "iqw") {
    return "user-desk-001";
  }
  return "user-io-001";
}

function cloneCaseRecord(record: PlatformCaseProjectionRecord): PlatformCaseProjectionRecord {
  return {
    projection: {
      ...record.projection,
      jurisdiction: cloneJurisdiction(record.projection.jurisdiction),
      subject_identifiers: [...record.projection.subject_identifiers],
    },
    org_id: record.org_id,
    unit_id: record.unit_id,
    assignment: cloneAssignment(record.assignment),
    linked_case_ids: [...record.linked_case_ids],
    field_classification: { ...record.field_classification },
    redaction_decision: {
      ...record.redaction_decision,
      fields_redacted: [...record.redaction_decision.fields_redacted],
    },
    retention_status: record.retention_status,
    projection_ttl_seconds: record.projection_ttl_seconds,
    source_authoritative: true,
  };
}

function cloneLinkRecord(record: PlatformCaseLinkRecord): PlatformCaseLinkRecord {
  return { ...record, source_authoritative: true };
}

function cloneJurisdiction(jurisdiction: PlatformCaseJurisdiction): PlatformCaseJurisdiction {
  return { ...jurisdiction };
}

function cloneAssignment(assignment: CaseProjectionAssignment): CaseProjectionAssignment {
  return { ...assignment };
}

function denyDecision(decision: AbacDecision): Exclude<AbacDecision, { allowed: true }> {
  if (decision.allowed) {
    throw new Error("missing case projection cannot be allowed");
  }
  return decision;
}

function isCaseRecord(record: PlatformCaseProjectionRecord | undefined): record is PlatformCaseProjectionRecord {
  return Boolean(record);
}

function isCaseField(value: string): value is CaseField {
  return CASE_FIELDS.includes(value as CaseField);
}
