# Pilot Platform Traceability Matrix

Version: 1.0  
Phase: P12 - Governance, Cutover, and Release Gate; P13 - Forensic Platform Adapter and Pilot Launch; P14 - Social Media Platform Adapter and Pilot Launch; P15 - Knowledge Platform Adapter and Pilot Launch; P16 - Pilot Cutover Readiness and Approval Evidence  
Scope: Release 1 platform control plane, DOPAMS/IQW/Forensic/Social Media/Knowledge pilot routes

## Global Gate Traceability

| Gate | Requirement | Covered phases | Evidence | Release status |
|---|---|---|---|---|
| G-SEC-001 | No active domain route appears in the platform app registry until that domain enforces platform claims server-side. | P2, P3, P6, P8, P11, P12, P13, P14, P15 | `docs/spec/auth-entitlements-contract.md`, `apps/platform-api/src/app-registry.ts`, `apps/dopams-api/src/middleware/platform-auth.ts`, `docs/spec/iqw-platform-auth-adapter.md`, `domains/iqw-api/src/middleware/platform_auth.py`, `apps/forensic-api/src/middleware/platform-auth.ts`, `apps/forensic-api/src/__tests__/platform-auth.test.ts`, `apps/social-media-api/src/middleware/platform-auth.ts`, `apps/social-media-api/src/__tests__/platform-auth.test.ts`, `domains/knowledge/api/src/platform-auth.ts`, `domains/knowledge/api/src/__tests__/platform-auth.test.ts`, `scripts/smoke-platform-local.sh`. | DOPAMS, IQW, P13 Forensic, P14 Social Media, and P15 Knowledge pilot routes only. |
| G-SEC-002 | Every platform allow/deny decision records claims snapshot, policy version, source/projection version, redaction decision, service path, outcome, and correlation ID. | P2, P3, P5, P6, P8, P9, P10, P12, P13, P14, P15 | `docs/spec/authorization-decision-evidence.md`, `packages/audit-ledger/src/decision-evidence.ts`, `apps/platform-api/src/__tests__/decision-evidence.test.ts`, `apps/platform-api/src/__tests__/case360.authz.test.ts`, `apps/forensic-api/src/__tests__/platform-auth.test.ts`, `apps/social-media-api/src/__tests__/platform-auth.test.ts`, `domains/knowledge/api/src/__tests__/platform-auth.test.ts`. | Decision evidence is release-blocking; evidence construction failure denies access. |
| G-SEC-003 | Central evidence APIs do not return `storage_uri` by default. | P3, P4, P5, P9, P12 | `docs/spec/data-classification-policy.md`, `fixtures/platform/evidence.json`, `packages/evidence-core`, `apps/platform-api/src/__tests__/evidence-projection.test.ts`, `apps/platform-api/src/__tests__/case360.authz.test.ts`. | Central evidence metadata only; storage-location exposure requires a future approved contract. |
| G-SEC-004 | Knowledge retrieval remains default-denied unless pre-retrieval scope filtering and citation filtering are proven by the P15 adapter. | P3, P4, P10, P11, P12, P15 | `docs/spec/knowledge-runtime-decision.md`, `docs/spec/knowledge-retrieval-security.md`, `docs/spec/knowledge-ingestion-event.schema.json`, `domains/knowledge/api/src/platform-auth.ts`, `domains/knowledge/api/src/platform-scope.ts`, `domains/knowledge/api/src/__tests__/platform-auth.test.ts`, `apps/platform-api/src/__tests__/knowledge-scope-contract.test.ts`, `/Users/n15318/RAG-app/apps/api/src/__tests__/retrieval/platform-scope-contract.test.ts`. | P15 exposes a bounded Knowledge pilot route; default ABAC deny remains unless the adapter enables scoped retrieval. |
| G-OPS-001 | Cutover and run-state governance are documented before any production pilot. | P0, P11, P12, P16 | `docs/spec/release-gate.md`, `docs/spec/cutover-governance-runbook.md`, `docs/spec/run-state-governance.md`, `docs/spec/pilot-cutover-approval.json`, `scripts/check-pilot-cutover-readiness.mjs`, this matrix. | P16 readiness package complete for human review; production approval remains required. |

## Requirement Traceability

| Requirement | Statement | Phases | Primary evidence | Verification |
|---|---|---|---|---|
| R-SEC-001 | Active platform routes require server-side platform claim enforcement. | P2, P3, P6, P8, P13, P14, P15 | Auth contract, ABAC policy, platform registry, DOPAMS/IQW/Forensic/Social Media/Knowledge adapters. | Authz tests, DOPAMS platform-auth tests, IQW Python platform-auth tests, Forensic platform-auth tests, Social Media platform-auth tests, Knowledge platform-auth tests, P11/P13/P14/P15 smoke route checks. |
| R-SEC-002 | Every allow and deny decision is auditable from immutable decision evidence. | P3, P5, P6, P9, P13, P14, P15 | Decision evidence contract, audit-ledger package, platform API decision evidence, case360 authz tests, Forensic/Social Media/Knowledge platform-auth tests. | P3, P5, P6, P9, P12, P13, P14, and P15 checks. |
| R-DATA-001 | Central case and evidence projections expose only classified, redacted metadata. | P3, P4, P9 | Data classification policy, pilot fixtures, projection services and migrations. | Projection tests, storage URI exclusion tests, case360 authz tests. |
| R-KNOW-001 | Knowledge query access requires scoped retrieval, filtered citations, and adapter-enabled default-denied ABAC. | P3, P10, P15 | Knowledge runtime decision, retrieval security proof contract, P15 Knowledge adapter, selected RAG-app scope contract. | Knowledge adapter tests, platform knowledge scope contract tests, RAG-app scope contract test, P15 app registry state. |
| R-OPS-001 | Production pilot requires cutover, rollback, access review, incident response, stale projection remediation governance, and pending human approval evidence. | P0, P11, P12, P16 | Source inventory, local deployment evidence, release gate, cutover runbook, run-state governance, `docs/spec/pilot-cutover-approval.json`, readiness checker. | P16 check plus human production approval. |

## Phase Traceability

| Phase | Name | Gate type | Required evidence | Exit check |
|---|---|---|---|---|
| P0 | Source Freeze, Secret Hygiene, and Import Map | Human | `docs/spec/source-inventory.md`, `docs/spec/secret-hygiene-report.md`, `docs/spec/import-map.yaml`, import and secret scanners. | `bash docs/spec/pipeline/checks/p0.sh` |
| P1 | Target Monorepo Layout | Human | `docs/spec/repo-layout.md`, root workspace scripts, import map. | `bash docs/spec/pipeline/checks/p1.sh` |
| P2 | Platform Auth Claim and Entitlement Contract | Human | `docs/spec/auth-entitlements-contract.md`, `docs/spec/auth-claim-fixtures.json`, `packages/authz`. | `bash docs/spec/pipeline/checks/p2.sh` |
| P3 | Data Classification, ABAC, Threat Model, and Decision Evidence | Human | `docs/spec/access-control-threat-model.md`, `docs/spec/data-classification-policy.md`, `docs/spec/authorization-decision-evidence.md`, authz ABAC and audit-ledger code. | `bash docs/spec/pipeline/checks/p3.sh` |
| P4 | Pilot Users, Cases, Evidence, and Classification Fixtures | Human | `docs/spec/pilot-fixtures.md`, `fixtures/platform/users.json`, `cases.json`, `evidence.json`, `denials.json`. | `bash docs/spec/pipeline/checks/p4.sh` |
| P5 | Platform Service Packages | Auto | `packages/authz`, `packages/audit-ledger`, `packages/case-core`, `packages/evidence-core`. | `bash docs/spec/pipeline/checks/p5.sh` |
| P6 | Platform API and App Registry | Auto | `apps/platform-api`, registry, entitlement checks, decision evidence tests, platform foundation migration. | `bash docs/spec/pipeline/checks/p6.sh` |
| P7 | Platform Web Shell | Human | `apps/platform-web`, app launcher, decision audit panel, app registry E2E. | `bash docs/spec/pipeline/checks/p7.sh` |
| P8 | Pilot Domain Auth Adapters | Human | DOPAMS platform-auth middleware, IQW platform-auth adapter, DOPAMS and Python negative auth tests. | `bash docs/spec/pipeline/checks/p8.sh` |
| P9 | Pilot Case and Evidence Projections | Human | Platform case/evidence migrations, projection services, case360 routes, projection authorization tests. | `bash docs/spec/pipeline/checks/p9.sh` |
| P10 | Knowledge Runtime Decision and Retrieval Security | Human | Knowledge runtime decision, ingestion event schema, retrieval security contract, knowledge scope test. | `bash docs/spec/pipeline/checks/p10.sh` |
| P11 | Integrated Local Deployment | Auto | `deploy/docker-compose/policing-platform.yml`, nginx local profile, `scripts/smoke-platform-local.sh`, platform pilot E2E. | `bash docs/spec/pipeline/checks/p11.sh` |
| P12 | Governance, Cutover, and Release Gate | Human | `docs/spec/release-gate.md`, `docs/spec/cutover-governance-runbook.md`, `docs/spec/run-state-governance.md`, this traceability matrix. | `bash docs/spec/pipeline/checks/p12.sh` |
| P13 | Forensic Platform Adapter and Pilot Launch | Human | `apps/forensic-api/src/middleware/platform-auth.ts`, `apps/forensic-api/src/__tests__/platform-auth.test.ts`, app registry Forensic launch state, local proxy route, P13 governance evidence. | `bash docs/spec/pipeline-p13/checks/p13.sh` |
| P14 | Social Media Platform Adapter and Pilot Launch | Human | `apps/social-media-api/src/middleware/platform-auth.ts`, `apps/social-media-api/src/__tests__/platform-auth.test.ts`, app registry Social Media launch state, local proxy route, P14 governance evidence. | `bash docs/spec/pipeline-p14/checks/p14.sh` |
| P15 | Knowledge Platform Adapter and Pilot Launch | Human | `domains/knowledge/api/src/platform-auth.ts`, `domains/knowledge/api/src/platform-scope.ts`, `domains/knowledge/api/src/__tests__/platform-auth.test.ts`, app registry Knowledge launch state, local proxy route, P15 governance evidence. | `bash docs/spec/pipeline-p15/checks/p15.sh` |
| P16 | Pilot Cutover Readiness and Approval Evidence | Human | `docs/spec/pilot-cutover-approval.json`, `scripts/check-pilot-cutover-readiness.mjs`, updated local deployment docs, cutover runbook, release gate, run-state governance, traceability, and manifest evidence. | `bash docs/spec/pipeline-p16/checks/p16.sh` |

## Release Check Mapping

| Check | Covers | Evidence retained |
|---|---|---|
| `npm run typecheck` | Root TypeScript compatibility for existing workspace surfaces included in the root script. | P12 terminal output summary. |
| `npm --workspace apps/platform-api run test` | Platform registry, decision evidence, projection, fixtures, and knowledge blocked behavior. | Platform API test output summary. |
| `npm --workspace apps/platform-web run test` | App launcher state rendering and planned/blocked module handling. | Platform web test output summary. |
| `npm --workspace apps/forensic-api exec -- vitest run src/__tests__/platform-auth.test.ts` | Forensic platform claim enforcement and decision evidence allow/deny coverage. | Forensic platform-auth test output summary. |
| `npm --workspace apps/forensic-api run typecheck` | Forensic adapter TypeScript compatibility. | Forensic typecheck output summary. |
| `npm --workspace apps/social-media-api exec -- vitest run src/__tests__/platform-auth.test.ts` | Social Media platform claim enforcement and decision evidence allow/deny coverage. | Social Media platform-auth test output summary. |
| `npm --workspace apps/social-media-api run typecheck` | Social Media adapter TypeScript compatibility. | Social Media typecheck output summary. |
| `npm --workspace domains/knowledge/api run test` | Knowledge platform claim enforcement, default ABAC deny, scoped retrieval, and citation filtering coverage. | Knowledge adapter test output summary. |
| `npm --workspace domains/knowledge/api run typecheck` | Knowledge adapter TypeScript compatibility. | Knowledge typecheck output summary. |
| `cd /Users/n15318/RAG-app && npm --workspace apps/api exec -- vitest run src/__tests__/retrieval/platform-scope-contract.test.ts` | Selected RAG-app runtime scope/citation contract remains green as reference evidence. | RAG-app scope contract output summary. |
| `bash scripts/smoke-platform-local.sh` | Integrated local profile, route blocking, DOPAMS/IQW/Forensic/Social Media/Knowledge pilot routing. | Smoke script output summary. |
| `bash docs/spec/pipeline/checks/p12.sh` | Full governance document presence, global gates traced, operations governance, phase traceability, and all release commands. | P12 release gate output summary. |
| `bash docs/spec/pipeline-p13/checks/p13.sh` | P13 Forensic adapter, registry launch state, local route profile, smoke checks, and manifest evidence. | P13 release gate output summary. |
| `bash docs/spec/pipeline-p14/checks/p14.sh` | P14 Social Media adapter, registry launch state, local route profile, smoke checks, and manifest evidence. | P14 release gate output summary. |
| `bash docs/spec/pipeline-p15/checks/p15.sh` | P15 Knowledge adapter, registry launch state, local route profile, smoke checks, selected RAG-app contract, and manifest evidence. | P15 release gate output summary. |
| `node scripts/check-pilot-cutover-readiness.mjs` | P16 machine-readable readiness consistency across approval JSON, docs, registry, nginx, smoke script, and manifest. | P16 readiness checker output summary. |
| `bash docs/spec/pipeline-p16/checks/p16.sh` | P16 cutover readiness package, pending approval record, predecessor P15 gate, and manifest evidence. | P16 release gate output summary. |

## Release Blocking Traceability Rules

- If an app is `planned` or `blocked`, traceability must show why it has no launch URL.
- If an app is `pilot` or `available`, traceability must show server-side platform claim enforcement and decision evidence.
- If a case or evidence projection is readable, traceability must show source version, projection version, classification, legal hold, redaction, and decision evidence.
- If a central evidence API could expose a storage location, traceability must show a separate approved contract; no such contract exists for Release 1.
- If Knowledge retrieval is requested, traceability must show the P15 adapter enables retrieval only after scoped retrieval and citation filtering pass.
- If rollback is invoked, traceability must preserve direct domain access, domain-local audit trails, platform decision evidence, legal hold state, and incident records.
