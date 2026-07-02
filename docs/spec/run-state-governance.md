# Run-State Governance

Version: 1.0  
Phase: P12 - Governance, Cutover, and Release Gate; P13 - Forensic Platform Adapter and Pilot Launch; P14 - Social Media Platform Adapter and Pilot Launch; P15 - Knowledge Platform Adapter and Pilot Launch; P16 - Pilot Cutover Readiness and Approval Evidence  
Applies after: Approved production pilot cutover for platform DOPAMS/IQW/Forensic/Social Media/Knowledge control-plane routes

## Governance Invariants

The pilot platform can run only while these invariants hold:

- no unauthorized app, case, evidence, or knowledge access is possible through the platform;
- allow and deny decisions can be reconstructed from decision evidence without relying on mutable route code;
- direct DOPAMS, IQW, Forensic, Social Media, and selected Knowledge runtime access, domain-local authorization, and domain audit trails remain available for rollback;
- legal hold, audit continuity, incident response, emergency revocation, access review, and stale projection remediation have named operational owners;
- Knowledge remains bounded to the P15 adapter path; retrieval is default-denied unless server-side claims, explicit Knowledge entitlement, pre-retrieval scope filtering, and citation filtering pass.

If any invariant fails, the affected route or projection is quarantined. A single quarantined route does not require stopping unrelated safe platform surfaces unless the failure affects shared auth, policy, audit, or registry controls.

## Owners And Duties

| Role | Duties |
|---|---|
| Platform release owner | Owns go/no-go, gate evidence, app registry change approval, and production pilot status. |
| Operations owner | Owns service health, rollback execution, monitoring, emergency route disablement, and runbook drills. |
| Security/risk owner | Owns G-SEC-001 through G-SEC-004 review, access review sign-off, incident severity, and risk acceptance. |
| DOPAMS domain owner | Owns DOPAMS direct access, adapter readiness, source audit continuity, and DOPAMS case/evidence source truth. |
| IQW domain owner | Owns IQW direct access, adapter readiness, source audit continuity, and IQW complaint/case source truth. |
| Forensic domain owner | Owns Forensic direct access, P13 adapter readiness, source audit continuity, and forensic evidence metadata source truth. |
| Social Media domain owner | Owns Social Media direct access, P14 adapter readiness, source audit continuity, and social media intelligence metadata source truth. |
| Knowledge/RAG domain owner | Owns Knowledge adapter readiness, selected runtime scope/citation contract evidence, and no-real-corpus pilot boundaries. |
| Legal/audit owner | Owns legal hold continuity, audit reconstruction, retention decisions, and compliance interpretation. |
| Projection owner | Owns source/projection freshness, redaction decisions, stale projection remediation, and projection quarantine. |

## Operating Rhythm

| Control | Frequency | Evidence retained |
|---|---|---|
| Route and app registry review | Daily for first seven pilot days, then weekly | Registry snapshot, launch URL diff, owner sign-off. |
| Access review | Daily for first seven pilot days, then weekly | Claim source review, domain permission review, MFA state, break-glass use, revocations. |
| Decision evidence completeness review | Daily for first seven pilot days, then weekly | Sampled allow/deny reconstruction from correlation IDs and decision IDs. |
| Legal hold reconciliation | Before cutover, after source legal hold changes, and weekly | Source legal hold report, projection reconciliation, denial reason review. |
| Stale projection review | Daily | Projection age report, source version comparison, quarantined projection list. |
| Incident and emergency revocation review | After every event | Incident record, containment actions, decision IDs, final disposition. |

## App Registry Governance

Only `pilot` or `available` apps with passed server-side platform claim gates may expose launch URLs. Planned and blocked apps must not include launch URLs and must not be proxied by the platform route layer.

Current allowed run-state:

- `platform-admin`: available control-plane route for approved administrators only;
- `dopams`: pilot route, backed by P8 DOPAMS platform auth adapter evidence;
- `iqw`: pilot route, backed by P8 IQW platform auth adapter evidence;
- `forensic`: pilot route, backed by P13 Forensic platform auth adapter evidence;
- `social-media`: pilot route, backed by P14 Social Media platform auth adapter evidence;
- `knowledge`: pilot route, backed by P15 Knowledge platform auth adapter, scoped retrieval, and citation filtering evidence.

Any registry change requires:

1. server-side platform claim gate evidence;
2. entitlement request definition;
3. decision evidence coverage;
4. route blocking check for non-active modules;
5. security/risk owner review;
6. P12, P13, P14, P15, P16, or successor release gate rerun.

Emergency route blocking may happen first, but it must be recorded and reviewed afterward.

## Authorization Decision Evidence

Every platform allow and deny must produce complete decision evidence before data, launch URLs, or retrieval output crosses a trust boundary. Required fields are claim or deny snapshot, policy version, entitlement policy version, source version, projection version, redaction decision, service path, action, outcome, reason, correlation ID, resource identity, and payload integrity hash.

Run-state rules:

- if decision evidence construction fails, the effective result is deny;
- corrections are append-only and linked by correlation ID or later supersession metadata;
- decision evidence must not log passwords, tokens, storage URIs, raw PII values, secret IDs, internal paths, or stack traces;
- auditors must be able to reconstruct sampled decisions using the evidence ledger, source/projection versions, policy versions, and redaction decision.

## Case And Evidence Projection Governance

Domain systems remain source-authoritative. The platform projection is readable only when source status, source version, projection version, projected timestamp, classification, legal hold status, retention status, jurisdiction, assignment, and redaction decision are current and complete.

The projection owner quarantines projections when:

- source status is deleted, sealed, purged, superseded, unknown, or retained-but-inaccessible;
- source version or projection version is missing;
- projection timestamp exceeds the configured TTL;
- legal hold status cannot be reconciled;
- classification or redaction profile is missing;
- a central evidence response would expose `storage_uri` by default.

Quarantine creates a deny path with decision evidence. Return to service requires rebuilding from the source-authoritative record and rerunning affected projection checks.

## Legal Hold And Audit Continuity

Legal hold status is evaluated before ordinary reads. Active legal hold denies investigation, intake, support, analysis, and launch-style reads unless the purpose is legal review, court preparation, or audit and all other ABAC dimensions pass.

Run-state legal hold controls:

- legal hold changes in source systems trigger projection review;
- held evidence storage locations are never exposed by central APIs by default;
- legal hold denials are sampled during decision evidence review;
- rollback preserves source legal hold records and platform decision evidence.

Audit continuity controls:

- direct domain audit trails remain retained under domain policies;
- platform decision evidence is append-only;
- correlation IDs are propagated across ingress, platform API, domain adapters, projection services, and proxy routes;
- clock drift or audit sink outage is an incident trigger.

## Access Review

Access review verifies that each user, claim source, domain permission, jurisdiction, assignment, purpose, clearance, and MFA state still has a valid pilot need.

Review actions:

- revoke stale sessions and claim sources;
- remove permissions with no current owner or purpose;
- check that platform admin does not imply operational case, evidence, or knowledge access;
- review break-glass entries for expiry, reason, and owner;
- compare denial reason trends against expected pilot activity;
- document accepted residual risks with owner and date.

## Emergency Revocation

Emergency revocation may be triggered by suspected unauthorized access, missing decision evidence, audit outage, storage URI exposure, legal hold conflict, stale projection exposure, compromised session, or app registry misconfiguration.

Available actions:

- revoke platform sessions or claim source versions;
- mark app registry entries blocked;
- remove launch URLs;
- disable proxy routes;
- invalidate affected domain-local sessions;
- quarantine projections;
- keep audit and decision evidence immutable for investigation.

Emergency revocation is reviewed within the next access review cycle and before any route is re-enabled.

## Incident Response

Incident response is required for unauthorized app, case, evidence, or knowledge access; failed decision evidence reconstruction; storage URI exposure; legal hold conflict; audit continuity failure; or stale projection exposure.

Response requires containment, evidence preservation, decision reconstruction, impact assessment, owner assignment, remediation, rerun of affected phase checks, and release owner approval before re-enable. If the incident affects shared auth, ABAC, app registry, or audit-ledger controls, the whole platform pilot is paused until the shared control passes.

## Production Pilot Gate

Production pilot can remain active only while:

- `bash docs/spec/pipeline-p16/checks/p16.sh` or its successor gate is green for the current release artifact;
- `docs/spec/pilot-cutover-approval.json` has been reviewed in the release/change record and all required approvals are current;
- app registry and proxy route state match the approved pilot scope;
- access review and decision evidence review are current;
- no unresolved incident blocks shared auth, policy, audit, legal hold, or projection controls;
- rollback has been tested or rehearsed for the current release window.

If any item expires or fails, move the affected surface to quarantine or rollback according to `docs/spec/cutover-governance-runbook.md`.
