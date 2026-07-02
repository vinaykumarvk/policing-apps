import casesFixture from "../../../../fixtures/platform/cases.json";
import evidenceFixture from "../../../../fixtures/platform/evidence.json";
import {
  type AbacDecision,
  type AbacOptions,
  type AbacRequest,
  type AbacResourceContext,
  type RedactionDecision,
  evaluateAbac,
} from "../../../../packages/authz/src";
import {
  PLATFORM_EVIDENCE_PROJECTION_SCHEMA_VERSION,
  type EvidenceClassificationLevel,
  type EvidenceField,
  type EvidenceLegalHoldStatus,
  type EvidenceRedactionDecision,
  type EvidenceRetentionStatus,
  type EvidenceSourceStatus,
  type PlatformEvidenceProjection,
  type PlatformEvidenceReadModel,
  toPlatformEvidenceReadModel,
  validateEvidenceRedactionDecision,
  validatePlatformEvidenceProjection,
} from "../../../../packages/evidence-core/src";
import type { PlatformCaseJurisdiction } from "../../../../packages/case-core/src";
import { DEFAULT_CASE_PROJECTION_TTL_SECONDS, type CaseProjectionAssignment } from "./case-projection";

export const EVIDENCE_PROJECTION_SERVICE_VERSION = "platform.evidence_projection.service.v1";
export const DEFAULT_EVIDENCE_PROJECTION_TTL_SECONDS = DEFAULT_CASE_PROJECTION_TTL_SECONDS;

export interface EvidenceProjectionReadInput {
  claimInput: unknown;
  serverVerified: boolean;
  correlationId: string;
  path?: string;
  now?: Date | string;
  expectedSourceVersion?: string;
  projectionMaxAgeSeconds?: number;
  purpose?: string;
}

export interface PlatformEvidenceProjectionRecord {
  projection: PlatformEvidenceProjection;
  org_id: string;
  unit_id?: string;
  jurisdiction: PlatformCaseJurisdiction;
  assignment: CaseProjectionAssignment;
  field_classification: Record<EvidenceField, EvidenceClassificationLevel>;
  metadata_redaction_decision: EvidenceRedactionDecision;
  legal_review_redaction_decision: EvidenceRedactionDecision;
  storage_reference: string;
  storage_uri_present: false;
  projection_ttl_seconds: number;
  source_authoritative: true;
}

export interface PlatformEvidenceLinkRecord {
  link_id: string;
  evidence_id: string;
  case_id: string;
  link_type: string;
  source_version: string;
  projection_version: string;
  projected_at: string;
  projection_ttl_seconds: number;
  source_authoritative: true;
}

export type EvidenceProjectionReadResult =
  | {
      status: "allowed";
      evidence_id: string;
      record: PlatformEvidenceProjectionRecord;
      decision: Extract<AbacDecision, { allowed: true }>;
      read_model: PlatformEvidenceReadModel;
    }
  | {
      status: "denied";
      evidence_id: string;
      record: PlatformEvidenceProjectionRecord;
      decision: Exclude<AbacDecision, { allowed: true }>;
    }
  | {
      status: "missing";
      evidence_id: string;
      decision: Exclude<AbacDecision, { allowed: true }>;
    };

export interface EvidenceProjectionService {
  getEvidence: (evidenceId: string) => PlatformEvidenceProjectionRecord | null;
  listEvidenceForCase: (caseId: string) => PlatformEvidenceProjectionRecord[];
  listEvidenceForCases: (caseIds: readonly string[]) => PlatformEvidenceProjectionRecord[];
  readEvidence: (evidenceId: string, input: EvidenceProjectionReadInput) => EvidenceProjectionReadResult;
}

export interface EvidenceProjectionServiceOptions {
  records?: readonly PlatformEvidenceProjectionRecord[];
  links?: readonly PlatformEvidenceLinkRecord[];
  projectionTtlSeconds?: number;
}

interface PilotCasesFixture {
  cases: PilotCaseFixture[];
}

interface PilotCaseFixture {
  case_id: string;
  org_id: string;
  unit_id: string;
  jurisdiction: PlatformCaseJurisdiction;
  assignment: CaseProjectionAssignment;
}

interface PilotEvidenceFixtureDocument {
  evidence: PilotEvidenceFixture[];
}

interface PilotEvidenceFixture {
  evidence_id: string;
  case_id: string;
  source_system: string;
  source_record_id: string;
  display_name: string;
  mime_type: string;
  size_bytes: number;
  hash_sha256: string;
  chain_of_custody_head: string;
  source_status: string;
  classification: string;
  legal_hold_status: string;
  retention_status: string;
  source_version: string;
  projection_version: string;
  projected_at: string;
  storage_uri_present: boolean;
  field_classification: Record<string, string>;
  redaction_profiles: {
    metadata: PilotEvidenceRedactionFixture;
    legal_review?: PilotEvidenceRedactionFixture;
  };
}

interface PilotEvidenceRedactionFixture {
  profile: string;
  fields_redacted: string[];
  storage_uri_exposed: boolean;
  reason: string;
}

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

const CLASSIFICATIONS: readonly EvidenceClassificationLevel[] = ["public", "restricted", "confidential", "secret"];
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
const LEGAL_HOLD_PURPOSES = new Set(["legal_review", "court_preparation", "audit"]);

export function createEvidenceProjectionService(
  options: EvidenceProjectionServiceOptions = {},
): EvidenceProjectionService {
  const projectionTtlSeconds = options.projectionTtlSeconds ?? DEFAULT_EVIDENCE_PROJECTION_TTL_SECONDS;
  const records = options.records ?? recordsFromFixture(projectionTtlSeconds);
  const links = options.links ?? linksFromRecords(records, projectionTtlSeconds);
  const recordById = new Map(records.map((record) => [record.projection.evidence_id, cloneEvidenceRecord(record)]));
  const linkRecords = links.map(cloneLinkRecord);

  return {
    getEvidence: (evidenceId) => {
      const record = recordById.get(evidenceId);
      return record ? cloneEvidenceRecord(record) : null;
    },
    listEvidenceForCase: (caseId) =>
      linkRecords
        .filter((link) => link.case_id === caseId)
        .map((link) => recordById.get(link.evidence_id))
        .filter(isEvidenceRecord)
        .map(cloneEvidenceRecord),
    listEvidenceForCases: (caseIds) => {
      const wanted = new Set(caseIds);
      const seen = new Set<string>();
      return linkRecords
        .filter((link) => wanted.has(link.case_id))
        .map((link) => recordById.get(link.evidence_id))
        .filter(isEvidenceRecord)
        .filter((record) => {
          if (seen.has(record.projection.evidence_id)) {
            return false;
          }
          seen.add(record.projection.evidence_id);
          return true;
        })
        .map(cloneEvidenceRecord);
    },
    readEvidence: (evidenceId, input) => readEvidence(evidenceId, input, recordById),
  };
}

export function recordsFromFixture(
  projectionTtlSeconds = DEFAULT_EVIDENCE_PROJECTION_TTL_SECONDS,
): PlatformEvidenceProjectionRecord[] {
  const fixture = evidenceFixture as PilotEvidenceFixtureDocument;
  const caseContextById = new Map((casesFixture as PilotCasesFixture).cases.map((entry) => [entry.case_id, entry]));
  return fixture.evidence.map((entry) => {
    const caseContext = caseContextById.get(entry.case_id);
    if (!caseContext) {
      throw new Error(`missing case context for evidence ${entry.evidence_id}`);
    }
    return recordFromFixture(entry, caseContext, projectionTtlSeconds);
  });
}

export function linksFromRecords(
  records: readonly PlatformEvidenceProjectionRecord[],
  projectionTtlSeconds = DEFAULT_EVIDENCE_PROJECTION_TTL_SECONDS,
): PlatformEvidenceLinkRecord[] {
  return records.map((record) => ({
    link_id: `LINK-${record.projection.case_id}-${record.projection.evidence_id}`,
    evidence_id: record.projection.evidence_id,
    case_id: record.projection.case_id,
    link_type: "case_evidence",
    source_version: record.projection.source_version,
    projection_version: record.projection.projection_version,
    projected_at: record.projection.projected_at,
    projection_ttl_seconds: projectionTtlSeconds,
    source_authoritative: true,
  }));
}

function readEvidence(
  evidenceId: string,
  input: EvidenceProjectionReadInput,
  recordById: ReadonlyMap<string, PlatformEvidenceProjectionRecord>,
): EvidenceProjectionReadResult {
  const record = recordById.get(evidenceId);
  if (!record) {
    const decision = evaluateAbac(input.claimInput, missingEvidenceRequest(evidenceId, input), abacOptions(input));
    return { status: "missing", evidence_id: evidenceId, decision: denyDecision(decision) };
  }

  const redaction = redactionForPurpose(record, input.purpose);
  const decision = evaluateAbac(
    input.claimInput,
    evidenceReadRequest(record, input, redaction),
    abacOptions(input, record.projection_ttl_seconds),
  );
  if (!decision.allowed) {
    return { status: "denied", evidence_id: evidenceId, record: cloneEvidenceRecord(record), decision };
  }

  return {
    status: "allowed",
    evidence_id: evidenceId,
    record: cloneEvidenceRecord(record),
    decision,
    read_model: toPlatformEvidenceReadModel(record.projection, redaction),
  };
}

function recordFromFixture(
  entry: PilotEvidenceFixture,
  caseContext: PilotCaseFixture,
  projectionTtlSeconds: number,
): PlatformEvidenceProjectionRecord {
  const projection: PlatformEvidenceProjection = {
    schema_version: PLATFORM_EVIDENCE_PROJECTION_SCHEMA_VERSION,
    evidence_id: entry.evidence_id,
    case_id: entry.case_id,
    source_system: entry.source_system,
    source_record_id: entry.source_record_id,
    display_name: entry.display_name,
    mime_type: entry.mime_type,
    size_bytes: entry.size_bytes,
    hash_sha256: entry.hash_sha256,
    chain_of_custody_head: entry.chain_of_custody_head,
    classification: classificationFromString(entry.classification),
    legal_hold_status: legalHoldFromString(entry.legal_hold_status),
    retention_status: retentionStatusFromString(entry.retention_status),
    source_version: entry.source_version,
    projection_version: entry.projection_version,
    projected_at: entry.projected_at,
    source_status: sourceStatusFromString(entry.source_status),
    storage_uri: null,
  };

  const validation = validatePlatformEvidenceProjection(projection);
  if (!validation.valid) {
    throw new Error(`invalid pilot evidence projection ${entry.evidence_id}: ${validation.issues.join("; ")}`);
  }

  const metadataRedaction = metadataRedactionDecision(entry.redaction_profiles.metadata.fields_redacted);
  const legalReviewRedaction = legalReviewRedactionDecision(
    entry.redaction_profiles.legal_review?.fields_redacted ?? ["storage_uri"],
  );
  validateEvidenceRedaction(entry.evidence_id, metadataRedaction);
  validateEvidenceRedaction(entry.evidence_id, legalReviewRedaction);

  return {
    projection,
    org_id: caseContext.org_id,
    unit_id: caseContext.unit_id,
    jurisdiction: cloneJurisdiction(caseContext.jurisdiction),
    assignment: {
      ...caseContext.assignment,
      case_id: entry.case_id,
      evidence_id: entry.evidence_id,
    },
    field_classification: fieldClassifications(entry.field_classification),
    metadata_redaction_decision: metadataRedaction,
    legal_review_redaction_decision: legalReviewRedaction,
    storage_reference: `platform-evidence-ref:${entry.evidence_id}`,
    storage_uri_present: false,
    projection_ttl_seconds: projectionTtlSeconds,
    source_authoritative: true,
  };
}

function evidenceReadRequest(
  record: PlatformEvidenceProjectionRecord,
  input: EvidenceProjectionReadInput,
  redaction: EvidenceRedactionDecision,
): AbacRequest {
  const projection = record.projection;
  const resourceContext = resourceContextForPurpose(record, input.purpose);
  return {
    action: "platform.evidence.read",
    path: input.path ?? `/api/v1/platform/evidence/${projection.evidence_id}`,
    correlation_id: input.correlationId,
    module: projection.source_system,
    domain: projection.source_system,
    permission: evidencePermission(projection.source_system),
    purpose: input.purpose ?? "case_review",
    require_mfa: true,
    server_verified: input.serverVerified,
    resource: {
      kind: "platform_evidence",
      resource_id: projection.evidence_id,
      source_system: projection.source_system,
      source_record_id: projection.source_record_id,
      source_version: projection.source_version,
      projection_version: projection.projection_version,
      projected_at: projection.projected_at,
      source_status: effectiveSourceStatus(record),
      classification: projection.classification,
      org_id: resourceContext.org_id,
      unit_id: resourceContext.unit_id,
      jurisdiction: cloneJurisdiction(resourceContext.jurisdiction),
      assignment: cloneAssignment(resourceContext.assignment),
      legal_hold_status: projection.legal_hold_status,
    },
    redaction_decision: abacRedaction(redaction),
  };
}

function resourceContextForPurpose(
  record: PlatformEvidenceProjectionRecord,
  purpose: string | undefined,
): {
  org_id: string;
  unit_id?: string;
  jurisdiction: PlatformCaseJurisdiction;
  assignment: CaseProjectionAssignment;
} {
  if (record.projection.legal_hold_status === "active" && LEGAL_HOLD_PURPOSES.has(purpose ?? "")) {
    return {
      org_id: "legal-cell",
      unit_id: "prosecution-review",
      jurisdiction: {
        country: record.jurisdiction.country,
        state: record.jurisdiction.state,
        district: record.jurisdiction.district,
      },
      assignment: {
        case_id: record.projection.case_id,
        evidence_id: record.projection.evidence_id,
      },
    };
  }
  return {
    org_id: record.org_id,
    unit_id: record.unit_id,
    jurisdiction: cloneJurisdiction(record.jurisdiction),
    assignment: cloneAssignment(record.assignment),
  };
}

function missingEvidenceRequest(evidenceId: string, input: EvidenceProjectionReadInput): AbacRequest {
  return {
    action: "platform.evidence.read",
    path: input.path ?? `/api/v1/platform/evidence/${evidenceId}`,
    correlation_id: input.correlationId,
    module: "platform",
    domain: "platform",
    permission: "evidence:metadata-read",
    purpose: input.purpose ?? "case_review",
    require_mfa: true,
    server_verified: input.serverVerified,
    resource: missingResource(evidenceId),
    redaction_decision: denyRedaction(),
  };
}

function missingResource(evidenceId: string): AbacResourceContext {
  return {
    kind: "platform_evidence",
    resource_id: evidenceId,
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
    assignment: { evidence_id: evidenceId },
    legal_hold_status: "unknown",
  };
}

function abacOptions(input: EvidenceProjectionReadInput, ttlSeconds?: number): AbacOptions {
  return {
    now: input.now,
    expectedSourceVersion: input.expectedSourceVersion,
    projectionMaxAgeSeconds: input.projectionMaxAgeSeconds ?? ttlSeconds ?? DEFAULT_EVIDENCE_PROJECTION_TTL_SECONDS,
  };
}

function effectiveSourceStatus(record: PlatformEvidenceProjectionRecord): EvidenceSourceStatus {
  if (record.projection.source_status !== "active") {
    return record.projection.source_status;
  }
  if (record.projection.retention_status === "purge_due" || record.projection.retention_status === "unknown") {
    return "retained_inaccessible";
  }
  return "active";
}

function evidencePermission(sourceSystem: string): string {
  return sourceSystem === "iqw" ? "complaint:read" : "evidence:metadata-read";
}

function redactionForPurpose(
  record: PlatformEvidenceProjectionRecord,
  purpose: string | undefined,
): EvidenceRedactionDecision {
  if (record.projection.legal_hold_status === "active" && LEGAL_HOLD_PURPOSES.has(purpose ?? "")) {
    return cloneRedaction(record.legal_review_redaction_decision);
  }
  return cloneRedaction(record.metadata_redaction_decision);
}

function metadataRedactionDecision(fields: readonly string[]): EvidenceRedactionDecision {
  return {
    profile: "evidence-metadata-v1",
    fields_redacted: normalizeEvidenceFields(fields),
    storage_uri_exposed: false,
    reason: "central_metadata_only",
  };
}

function legalReviewRedactionDecision(fields: readonly string[]): EvidenceRedactionDecision {
  return {
    profile: "legal-review-v1",
    fields_redacted: normalizeEvidenceFields(fields),
    storage_uri_exposed: false,
    reason: "legal_review",
  };
}

function denyRedaction(): RedactionDecision {
  return {
    profile: "deny-none",
    fields_redacted: [...EVIDENCE_FIELDS],
    storage_uri_exposed: false,
    reason: "deny_no_data_returned",
  };
}

function abacRedaction(redaction: EvidenceRedactionDecision): RedactionDecision {
  return {
    profile: redaction.profile,
    fields_redacted: [...redaction.fields_redacted],
    storage_uri_exposed: false,
    reason: redaction.reason,
  };
}

function validateEvidenceRedaction(evidenceId: string, decision: EvidenceRedactionDecision): void {
  const result = validateEvidenceRedactionDecision(decision);
  if (!result.valid) {
    throw new Error(`invalid pilot evidence redaction ${evidenceId}: ${result.issues.join("; ")}`);
  }
}

function fieldClassifications(input: Record<string, string>): Record<EvidenceField, EvidenceClassificationLevel> {
  const entries = EVIDENCE_FIELDS.map((field) => [field, classificationFromString(input[field] ?? "secret")] as const);
  return Object.fromEntries(entries) as Record<EvidenceField, EvidenceClassificationLevel>;
}

function normalizeEvidenceFields(fields: readonly string[]): EvidenceField[] {
  const storageUriField: EvidenceField = "storage_uri";
  const normalized = fields.filter(isEvidenceField);
  return normalized.includes(storageUriField)
    ? [...new Set(normalized)]
    : [...new Set([...normalized, storageUriField])];
}

function sourceStatusFromString(value: string): EvidenceSourceStatus {
  return SOURCE_STATUSES.includes(value as EvidenceSourceStatus) ? (value as EvidenceSourceStatus) : "unknown";
}

function legalHoldFromString(value: string): EvidenceLegalHoldStatus {
  return LEGAL_HOLD_STATUSES.includes(value as EvidenceLegalHoldStatus) ? (value as EvidenceLegalHoldStatus) : "unknown";
}

function retentionStatusFromString(value: string): EvidenceRetentionStatus {
  if (value === "hold_active") {
    return "hold";
  }
  if (value === "standard") {
    return "active";
  }
  return RETENTION_STATUSES.includes(value as EvidenceRetentionStatus) ? (value as EvidenceRetentionStatus) : "unknown";
}

function classificationFromString(value: string): EvidenceClassificationLevel {
  return CLASSIFICATIONS.includes(value as EvidenceClassificationLevel) ? (value as EvidenceClassificationLevel) : "secret";
}

function cloneEvidenceRecord(record: PlatformEvidenceProjectionRecord): PlatformEvidenceProjectionRecord {
  return {
    projection: { ...record.projection },
    org_id: record.org_id,
    unit_id: record.unit_id,
    jurisdiction: cloneJurisdiction(record.jurisdiction),
    assignment: cloneAssignment(record.assignment),
    field_classification: { ...record.field_classification },
    metadata_redaction_decision: cloneRedaction(record.metadata_redaction_decision),
    legal_review_redaction_decision: cloneRedaction(record.legal_review_redaction_decision),
    storage_reference: record.storage_reference,
    storage_uri_present: false,
    projection_ttl_seconds: record.projection_ttl_seconds,
    source_authoritative: true,
  };
}

function cloneLinkRecord(record: PlatformEvidenceLinkRecord): PlatformEvidenceLinkRecord {
  return { ...record, source_authoritative: true };
}

function cloneRedaction(redaction: EvidenceRedactionDecision): EvidenceRedactionDecision {
  return {
    ...redaction,
    fields_redacted: [...redaction.fields_redacted],
    storage_uri_exposed: false,
  };
}

function cloneJurisdiction(jurisdiction: PlatformCaseJurisdiction): PlatformCaseJurisdiction {
  return { ...jurisdiction };
}

function cloneAssignment(assignment: CaseProjectionAssignment): CaseProjectionAssignment {
  return { ...assignment };
}

function denyDecision(decision: AbacDecision): Exclude<AbacDecision, { allowed: true }> {
  if (decision.allowed) {
    throw new Error("missing evidence projection cannot be allowed");
  }
  return decision;
}

function isEvidenceRecord(
  record: PlatformEvidenceProjectionRecord | undefined,
): record is PlatformEvidenceProjectionRecord {
  return Boolean(record);
}

function isEvidenceField(value: string): value is EvidenceField {
  return EVIDENCE_FIELDS.includes(value as EvidenceField);
}
