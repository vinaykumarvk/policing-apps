# Access Control Threat Model

Version: 1.0  
Phase: P3 - Data Classification, ABAC, Threat Model, and Decision Evidence  
Traceability: R-SEC-001, R-SEC-002, R-DATA-001, R-KNOW-001

## Scope

This threat model covers the first platform control-plane release before any active platform-routed domain launch. It applies to pilot DOPAMS and IQW reads, central `platform_case` and `platform_evidence` projections, app launch checks, decision evidence reads, and future knowledge retrieval. Domain systems remain authoritative for their own records; platform policy may only narrow access.

The protected read paths for P3 are:

- `platform.case.read` for `/api/v1/platform/cases/:caseId`
- `platform.evidence.read` for `/api/v1/platform/evidence/:evidenceId`
- `platform.app.launch` for future active launch checks
- `platform.knowledge.retrieve` for future knowledge query retrieval
- `platform.decision_evidence.read` for audit-only decision evidence review

No app registry route may become active in this phase. These policies define the gate that later platform API and domain adapters must call.

## Assets

- Platform claims and entitlement dimensions from `docs/spec/auth-entitlements-contract.md`.
- Field-level classified `platform_case` and `platform_evidence` projection rows.
- Source record version, projection version, projection timestamp, legal hold status, source deletion/sealing state, and redaction decision.
- Immutable authorization decision evidence for every allow and deny.
- Knowledge retrieval candidates, citations, snippets, and source metadata.

## Trust Boundaries

The browser shell is not trusted for authorization. It may hide unavailable modules, but server-side platform API and domain adapters must re-evaluate claims, ABAC resource policy, and evidence completeness on every read or launch decision.

Projection data is not authoritative. A platform projection is readable only when it carries a current `source_version`, `projection_version`, `projected_at`, source status, classification, legal hold status, and redaction profile. Missing or stale projection state denies by default.

Knowledge retrieval is untrusted until scoped retrieval and citation filtering are proven. A query may not use vector, graph, or keyword candidates unless each candidate has passed the same classification, jurisdiction, assignment, legal hold, redaction, and freshness checks as direct case/evidence reads.

## Threats and Controls

| Threat | Risk | Required control |
|---|---|---|
| UI-only entitlement checks expose a route | Unauthorized domain access | Server-side claim validation and ABAC evaluation are mandatory before route launch; app registry stays planned/blocked until domain enforcement is proven. |
| Missing, malformed, expired, stale, or unsigned claims | Access with invalid identity context | Deny by default through P2 claim validation and require `serverVerified: true`. |
| Jurisdiction mismatch | Cross-district or cross-station exposure | Require country/state match and enforce station, district, state, or national scope from the claim. |
| Assignment bypass | Unassigned case or evidence read | Require case, evidence, queue, jurisdiction-wide, or domain-wide assignment appropriate to the resource. |
| Clearance mismatch | Sensitive or secret fields returned to lower-clearance users | Compare resource classification to claim clearance and redact fields above the allowed view. |
| Purpose-of-use drift | Operational data read for an unapproved purpose | Require request purpose to be present in claims and compatible with legal hold and data classification policy. |
| Legal hold conflict | Held evidence or case used for ordinary operational action | Deny ordinary investigation/support reads while legal hold is active; allow only legal review, court preparation, or audit when the claim carries matching permission, assignment, clearance, jurisdiction, and MFA. |
| Stale projection | Source changed or deleted after platform snapshot | Deny when projection timestamp exceeds TTL, `source_version` or `projection_version` is missing, or source status is deleted, sealed, purged, or unknown. |
| Redaction bypass | Storage location or protected fields returned from central APIs | Redaction decision is mandatory. `storage_uri` is excluded by default and may only be exposed by a future explicit, audited exception outside P3. |
| Decision evidence gaps | Allow or deny cannot be reconstructed | Every outcome records claims snapshot, policy version, source/projection version, redaction decision, path, outcome, and correlation ID before data leaves the platform boundary. |
| Retrieval leakage | Knowledge answer cites unauthorized source | Retrieval candidates and citations must be filtered before generation; knowledge UI remains disabled until proof exists. |

## Deny-By-Default Rules

The platform denies a pilot read path when any policy input is missing, stale, unsupported, ambiguous, or inconsistent. Required inputs include claim snapshot, policy version, service path, resource kind, domain, source record id, source version, projection version, projection timestamp, source status, classification, jurisdiction, assignment id, redaction decision, correlation ID, and server verification state.

Allow decisions are valid only after entitlement checks, ABAC resource checks, legal hold handling, projection freshness, source status, and redaction completeness all pass. A successful entitlement decision alone is not enough to read `platform_case`, `platform_evidence`, or retrieval candidates.

## Escalation

Escalate before implementation proceeds if real case data is required to define classification, if a legal hold can plausibly allow and deny the same path with equal evidence, if jurisdiction cannot be resolved from the claim and resource, or if any route can return data before complete decision evidence is built.
