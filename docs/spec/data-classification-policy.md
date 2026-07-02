# Data Classification Policy

Version: 1.0  
Phase: P3 - Data Classification, ABAC, Threat Model, and Decision Evidence  
Traceability: R-DATA-001, R-SEC-001, R-SEC-002

## Classification Levels

The platform uses the same ordering as claim clearance: `public`, `restricted`, `confidential`, and `secret`. Reads require claim clearance greater than or equal to the resource classification. Field-level redaction still applies after resource-level clearance passes.

Classifications are conservative. If a source adapter cannot classify a field, the platform treats the field as `secret` and redacts it from central responses. If a projection cannot classify the resource, the ABAC evaluator denies the read.

## Redaction Profiles

Every read decision must produce a redaction decision with these fields:

- `profile`: named profile such as `case-summary-v1`, `evidence-metadata-v1`, `legal-review-v1`, or `deny-none`.
- `fields_redacted`: response fields withheld because of classification, legal hold, or central API policy.
- `storage_uri_exposed`: always `false` for P3 central evidence APIs.
- `reason`: short machine-readable reason for the chosen profile.

The platform may return metadata needed for discovery and audit, but it must not expose evidence `storage_uri` by default. Future storage-location access requires a separate contract, a privileged purpose, explicit decision evidence, and route-level approval outside P3.

## `platform_case`

| Field | Classification | Default P3 behavior |
|---|---:|---|
| `case_id` | restricted | Return only after ABAC allows the case read. |
| `source_system` | restricted | Return for auditability and cross-domain linking. |
| `source_record_id` | restricted | Return when needed to reconcile source systems. |
| `case_number` | restricted | Return for assigned operational and legal users. |
| `title` | confidential | Redact unless claim clearance is `confidential` or higher and purpose matches. |
| `summary` | confidential | Redact unless claim clearance is `confidential` or higher and purpose matches. |
| `status` | restricted | Return after ABAC allow. |
| `jurisdiction` | restricted | Return after ABAC allow; used in authorization. |
| `assigned_unit_id` | restricted | Return after ABAC allow; used in assignment checks. |
| `lead_investigator_id` | confidential | Redact from non-supervisory and non-assigned users. |
| `subject_identifiers` | secret | Redact from platform summary reads unless a future route explicitly requires them. |
| `legal_hold_status` | confidential | Return only to legal, supervisory, audit, or assigned evidence roles. |
| `source_version` | restricted | Required in decision evidence. |
| `projection_version` | restricted | Required in decision evidence. |

## `platform_evidence`

| Field | Classification | Default P3 behavior |
|---|---:|---|
| `evidence_id` | restricted | Return only after ABAC allows the evidence read. |
| `case_id` | restricted | Return after ABAC allow. |
| `source_system` | restricted | Return for reconciliation. |
| `source_record_id` | restricted | Return for reconciliation. |
| `display_name` | confidential | Redact unless claim clearance is `confidential` or higher and purpose matches. |
| `mime_type` | restricted | Return after ABAC allow. |
| `size_bytes` | restricted | Return after ABAC allow. |
| `hash_sha256` | confidential | Return to evidence, forensic, legal, or audit purposes only. |
| `chain_of_custody_head` | confidential | Return to evidence, forensic, legal, or audit purposes only. |
| `classification` | restricted | Return after ABAC allow. |
| `legal_hold_status` | confidential | Return to legal, supervisory, audit, or assigned evidence roles. |
| `retention_status` | confidential | Return to legal, supervisory, audit, or assigned evidence roles. |
| `storage_uri` | secret | Never returned by central APIs by default in P3. |
| `source_version` | restricted | Required in decision evidence. |
| `projection_version` | restricted | Required in decision evidence. |

## Legal Hold Policy

When `legal_hold_status` is active, ordinary investigation, intake, support, analysis, and launch-style reads deny by default. Reads can proceed only for `legal_review`, `court_preparation`, or `audit` purposes and only when the claim has matching module/domain permission, jurisdiction, assignment, clearance, MFA, and a complete redaction decision. Legal hold never permits mutation, purge, archive, package export, or storage-location disclosure through this policy.

## Projection Freshness

Every projection row must include `source_version`, `projection_version`, and `projected_at`. P3 ABAC denies a read when any field is missing or when `projected_at` is older than the configured TTL. A deleted, sealed, purged, superseded, unknown, or retained-but-inaccessible source status denies until the adapter produces a fresh projection with a policy-compatible status.

## Knowledge Retrieval

Knowledge retrieval candidates inherit the highest classification among their cited case/evidence fields. Retrieval is disabled by default until pre-retrieval scope filtering and citation filtering are proven. Candidate snippets must carry the same resource metadata and redaction decision as direct reads; otherwise the candidate is dropped before generation.
