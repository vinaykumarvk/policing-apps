# Cutover Governance Runbook

Version: 2.0  
Phase: P16 - Pilot Cutover Readiness and Approval Evidence  
Applies to: Release 1 platform control-plane pilot for DOPAMS, IQW, Forensic, Social Media, and Knowledge  
Approval state: pending human approval in `docs/spec/pilot-cutover-approval.json`

## Purpose

This runbook governs the transition from direct domain-app access to the pilot platform shell while preserving original domain app access, domain-local authorization, platform decision evidence, legal hold continuity, and audit trails.

P16 does not approve production cutover. It records the readiness package and approval requirements for a human-controlled cutover decision.

The platform may narrow access. It must not replace domain authorization, delete domain audit history, expose evidence storage locations by default, ingest real Knowledge corpus data, or become the only route to any pilot domain until production pilot cutover is formally approved and monitored.

## Required Approvals

Cutover cannot start until every role in `docs/spec/pilot-cutover-approval.json` is updated outside this phase and recorded in the release ticket or operational change record.

| Approval | Owner role | Required evidence |
|---|---|---|
| Release go/no-go | Platform release owner | Passing `bash docs/spec/pipeline-p16/checks/p16.sh`, release window, rollback contact list. |
| Security/risk acceptance | Security/risk owner | Confirmation that G-SEC-001 through G-SEC-004 remain satisfied. |
| DOPAMS participation | DOPAMS domain owner | `/domains/dopams`, P8 DOPAMS adapter evidence, direct DOPAMS rollback route. |
| IQW participation | IQW domain owner | `/domains/iqw`, P8 IQW adapter evidence, direct IQW rollback route. |
| Forensic participation | Forensic domain owner | `/domains/forensic`, P13 Forensic adapter evidence, direct Forensic rollback route. |
| Social Media participation | Social Media domain owner | `/domains/social-media`, P14 Social Media adapter evidence, direct Social Media rollback route. |
| Knowledge/RAG participation | Knowledge/RAG domain owner | `/domains/knowledge`, P15 Knowledge adapter evidence, no-real-corpus boundary. |
| Legal hold continuity | Legal/audit owner | Legal hold reconciliation report for pilot cases/evidence and audit reconstruction plan. |
| Operations readiness | Operations owner | Emergency revocation, incident response, access review, rollback rehearsal, and stale projection remediation rosters. |

## Pre-Cutover Checklist

1. Run `bash docs/spec/pipeline-p16/checks/p16.sh` from a clean release environment.
2. Confirm `docs/spec/pilot-cutover-approval.json` still marks every approval as `pending` until humans sign off.
3. Confirm the only pilot domain launch URLs are `/domains/dopams`, `/domains/iqw`, `/domains/forensic`, `/domains/social-media`, and `/domains/knowledge`.
4. Confirm every launchable domain has server-side platform claim gate evidence: P8 for DOPAMS/IQW, P13 for Forensic, P14 for Social Media, and P15 for Knowledge.
5. Confirm DOPAMS, IQW, Forensic, Social Media, and Knowledge adapters reject missing, stale, revoked, wrong-module, wrong-jurisdiction, wrong-clearance, wrong-assignment, wrong-purpose, or non-MFA claims as applicable.
6. Confirm Knowledge remains bounded: no real corpus ingestion, pre-retrieval scope filtering before search, citation filtering before response, and default ABAC deny without the P15 adapter path.
7. Confirm central case and evidence projections deny stale, missing, deleted, sealed, purged, retained-inaccessible, or legally held records unless the purpose and claim explicitly permit the read.
8. Confirm decision evidence can reconstruct every allow and deny from claim snapshot, policy version, source/projection version, redaction decision, service path, outcome, and correlation ID.
9. Confirm direct DOPAMS, IQW, Forensic, Social Media, and selected Knowledge runtime URLs remain documented and reachable for rollback.
10. Confirm audit sinks are append-only and clock synchronization is configured for platform, proxy, and domain services.
11. Confirm legal hold status for pilot cases/evidence is reconciled from source systems before any projection is exposed.

## Active Investigation Transition

Active investigations remain authoritative in their source domain systems. The platform pilot provides launch control and approved synthetic or pilot-scoped projection reads only. Before adding an active investigation to the pilot:

- the domain owner records source case id, source evidence ids, current source version, legal hold status, assigned units, jurisdiction, clearance, and purpose constraints;
- the projection owner verifies projection freshness and links the source record to platform metadata without copying storage locations by default;
- the legal/audit owner confirms whether legal hold is active and whether ordinary investigation reads must be denied;
- the release owner records the case as pilot-included in the change record.

If a case becomes sensitive, sealed, purged, stale, retained-inaccessible, or legally held in a way that conflicts with ordinary reads, the platform route denies or degrades immediately. There is no manual override that returns platform data without decision evidence.

## Cutover Sequence

1. Confirm every required human approval is recorded outside P16.
2. Announce the approved release window and rollback contact list.
3. Freeze app registry changes except emergency revocation during the window.
4. Capture pre-cutover snapshots of registry state, policy versions, claim fixture version, projection versions, route configuration, and `docs/spec/pilot-cutover-approval.json`.
5. Start or update platform services using the approved production deployment path.
6. Verify health, readiness, and route blocking before exposing users to the shell.
7. Enable pilot user access to the platform shell for the approved users and routes only.
8. Run live smoke checks:
   - `/api/v1/platform/health`
   - `/api/v1/platform/apps?limit=100`
   - `/domains/dopams/health`
   - `/domains/iqw/health`
   - `/domains/forensic/health`
   - `/domains/social-media/health`
   - `/domains/knowledge/health`
9. Run persona-scoped registry checks with `X-Platform-Smoke-Persona: forensic`, `X-Platform-Smoke-Persona: analyst`, and `X-Platform-Smoke-Persona: knowledge`.
10. Review first allow and deny decision evidence records for each pilot route.
11. Monitor access denials, stale projection denials, legal hold denials, Knowledge citation denials, and audit sink errors for the first operating window.
12. Move to run-state governance only after the release owner and operations owner confirm no stop condition is active.

## Audit Continuity

Domain audit trails remain the system of record for domain-local actions. Platform audit and authorization decision evidence provide the control-plane record for platform launches and central projection reads.

Cutover must preserve original domain audit tables, logs, retention settings, platform authorization decision evidence, ingress correlation IDs, policy version, entitlement policy version, source/projection version, and redaction decision for each platform decision.

If the platform cannot append required decision evidence, the effective authorization outcome is deny. Operators must not delete or overwrite domain or platform audit evidence during cutover or rollback.

## Legal Hold Continuity

Legal hold status is source-authoritative. Before cutover, domain owners and the legal/audit owner reconcile all pilot case and evidence legal hold flags. While legal hold is active, ordinary investigation, intake, support, analysis, and launch-style reads deny by default unless the purpose is legal review, court preparation, or audit and all other ABAC dimensions pass.

No platform route exposes evidence storage location by default. Rollback preserves source legal hold records and platform denials already written to the decision ledger.

## Emergency Revocation

Emergency revocation is used when a user, session, app route, policy version, projection, or Knowledge retrieval path is suspected of exposing unauthorized access.

Immediate actions:

1. Revoke the platform session or claim source for affected users.
2. Mark affected app registry entries as blocked or remove launch URLs through the approved emergency change path.
3. Disable or remove affected proxy routes for platform-launched access.
4. Invalidate domain sessions if the incident includes domain-local compromise.
5. Quarantine affected projections or Knowledge retrieval scope.
6. Preserve platform and domain audit evidence; do not purge logs as part of containment.
7. Record revocation reason, affected correlation IDs, decision IDs, and owner in the incident record.

Emergency revocation may happen during a cutover freeze. It must be reviewed in the next access review and incident review cycle.

## Incident Response

Trigger incident response when there is suspected unauthorized app, case, evidence, social-media, forensic, or knowledge access; missing decision evidence; storage URI exposure; audit sink failure; legal hold conflict; stale projection returned as readable; or citation filtering failure.

Incident response steps:

1. Contain by disabling affected platform route, policy, projection, user session, or Knowledge retrieval path.
2. Preserve evidence from platform logs, decision evidence, proxy logs, domain audit, and projection version snapshots.
3. Reconstruct access decisions from correlation IDs and decision IDs.
4. Determine whether data crossed a trust boundary and whether legal/audit notification is required.
5. Remediate policy, adapter, projection, citation filtering, or route configuration.
6. Rerun P16 checks and affected predecessor checks before re-enabling the route.
7. Document accepted residual risk with owner and date if the release owner permits continued pilot operation.

## Access Review

Access review is mandatory before cutover, daily for the first seven pilot days, weekly during the remaining pilot, and immediately after emergency revocation, incident response, or app registry change.

The review covers active launchable apps, claim sources, domain permissions, jurisdiction scope, assignment scope, MFA state, platform admin access, break-glass usage, decision evidence completeness, Knowledge citation denials, and denials by reason code. Any entitlement with no current owner or no valid purpose is revoked or quarantined.

## Stale Projection Remediation

Platform projections deny by default when source version, projection version, source status, projection timestamp, legal hold status, classification, or redaction decision is missing or stale.

Remediation steps:

1. Quarantine the projection from platform reads.
2. Confirm source system state and current source version.
3. Rebuild the projection from the source-authoritative record using the approved projection job.
4. Recompute classification, legal hold state, retention status, and redaction decision.
5. Append decision evidence for denied attempts during the stale period.
6. Rerun projection authorization tests or affected phase checks before returning the projection to pilot visibility.

Manual edits to make a stale projection readable are prohibited.

## Rollback

Rollback preserves original domain app access and audit trails. Rollback does not delete decision evidence created during the pilot.

Rollback sequence:

1. Announce rollback and assign incident or change record owner.
2. Disable platform launch URLs for `/domains/dopams`, `/domains/iqw`, `/domains/forensic`, `/domains/social-media`, and `/domains/knowledge` or mark affected entries blocked in the registry.
3. Remove affected platform proxy routes.
4. Keep direct DOPAMS, IQW, Forensic, Social Media, and selected Knowledge runtime URLs, domain-local auth, and domain audit sinks active.
5. Preserve platform audit ledger, decision evidence, proxy logs, projection snapshots, and release check output.
6. Stop or scale down platform shell/API only after logs are flushed and evidence retention is confirmed.
7. Reconcile legal hold and active investigation status in source systems.
8. Record rollback reason, affected users/routes, last known good checks, and restart criteria.

Retry is allowed only after the failed gate is fixed, evidence is updated, and the release gate is rerun from a clean state.
