# Authorization Decision Evidence

Version: 1.0  
Phase: P3 - Data Classification, ABAC, Threat Model, and Decision Evidence  
Traceability: R-SEC-002, R-SEC-001, R-DATA-001

## Purpose

Every platform allow and deny must be reconstructable without querying mutable route code. The decision evidence record is an append-only ledger entry produced before a platform read, launch, audit lookup, or retrieval result crosses a trust boundary.

## Schema

The P3 evidence schema version is `platform.authorization_decision_evidence.v1`. A complete record includes:

- `decision_id`: deterministic or generated identifier for the ledger row.
- `evidence_schema_version`: exact schema identifier.
- `occurred_at`: ISO-8601 decision timestamp.
- `correlation_id`: request correlation ID propagated from ingress.
- `outcome`: `allow` or `deny`.
- `reason`: machine-readable reason such as `ALLOW`, `STALE_PROJECTION`, `LEGAL_HOLD_DENIED`, or `CLAIMS_DENIED`.
- `policy_version`: ABAC policy version used for the decision.
- `entitlement_policy_version`: entitlement policy version used for claim dimensions.
- `path`: route or service path, for example `/api/v1/platform/evidence/:evidenceId`.
- `action`: stable action id such as `platform.evidence.read`.
- `claims_snapshot`: the P2 claim evidence snapshot, or a deny snapshot with validation failure details when claims cannot be validated.
- `resource`: resource kind, resource id, source system, source record id, source version, projection version, and source status.
- `redaction_decision`: profile, redacted fields, `storage_uri_exposed`, and reason.
- `retrieval`: optional retrieval path and citation ids for knowledge queries.
- `decision_inputs`: completeness markers for server verification, projection freshness, legal hold, jurisdiction, assignment, clearance, purpose, and MFA.
- `integrity`: deterministic canonical payload hash for tamper evidence.

The central API response for decision evidence must not expose any evidence `storage_uri` by default. The ledger may record that a storage URI was not exposed through `redaction_decision.storage_uri_exposed: false`; it must not store the actual storage URI in this P3 contract.

## Completeness Rules

An allow or deny record is invalid if it omits the claims snapshot or deny snapshot, policy version, source version, projection version, redaction decision, path, outcome, or correlation ID. Denies caused before claim validation still record a claim-deny snapshot containing schema/source/session fields when safely available plus the validation reason.

The ABAC evaluator must not return `allowed: true` unless it can also return the complete decision evidence input. If evidence construction fails, the effective authorization outcome is deny.

## Immutability

The audit-ledger implementation freezes the decision evidence object returned to callers and computes `integrity.payload_hash` over the canonical payload excluding the `integrity` object. Persistent storage must be append-only. Corrections are new records linked by correlation ID or future supersession metadata; existing records are never updated in place.

## Redaction Evidence

The redaction decision is part of the authorization result, not a later response formatting detail. For P3, `storage_uri_exposed` must be `false` for all central `platform_evidence` reads. Fields withheld by policy are listed explicitly so auditors can verify why a user saw metadata, a redacted summary, or a full legal-review profile.

## Retrieval Evidence

Future knowledge decisions must record retrieval path, candidate source ids, filtered citation ids, policy version, source/projection version, and redaction profile. Until scoped retrieval and citation filtering tests pass, `platform.knowledge.retrieve` denies by default.

## Traceability

This contract satisfies:

- R-SEC-001 by requiring server-side claim and ABAC checks before active platform routes.
- R-SEC-002 by making every allow and deny auditable from immutable decision evidence.
- R-DATA-001 by recording redaction, classification, and `storage_uri` exclusion decisions for central projections.
