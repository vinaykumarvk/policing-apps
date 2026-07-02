# Pilot Platform Release Gate

Version: 1.0  
Phase: P12 - Governance, Cutover, and Release Gate; P13 - Forensic Platform Adapter and Pilot Launch; P14 - Social Media Platform Adapter and Pilot Launch; P15 - Knowledge Platform Adapter and Pilot Launch; P16 - Pilot Cutover Readiness and Approval Evidence  
Gate date: 2026-07-02  
Scope: Release 1 platform control plane for DOPAMS, IQW, P13-gated Forensic, P14-gated Social Media, and P15-gated Knowledge pilot routes only

## Gate Position

This release gate prepares the pilot platform for human approval. It does not approve production deployment by itself. Production pilot cutover remains No-Go until the release owner, security/risk owner, domain owners, legal/audit owner, and operations owner approve the cutover record in `docs/spec/pilot-cutover-approval.json`, the runbook in `docs/spec/cutover-governance-runbook.md`, and the run-state controls in `docs/spec/run-state-governance.md`.

The release can pass the P12 evidence gate only when:

- unauthorized app, case, evidence, and knowledge access is blocked by server-side controls;
- every platform allow or deny decision can be reconstructed from immutable decision evidence;
- rollback preserves direct domain app access and all domain plus platform audit trails;
- cutover, access review, incident response, emergency revocation, stale projection remediation, legal hold continuity, and audit continuity are documented.

## Release Scope

| Surface | Release 1 state | Release gate decision |
|---|---|---|
| Platform API and web shell | Available for pilot control-plane use | Allowed only with passing P6/P7/P11/P12 evidence. |
| DOPAMS | Pilot route | Allowed only through server-side P8 platform claim adapter and entitlement decision evidence. |
| IQW | Pilot route | Allowed only through server-side P8 platform claim adapter and entitlement decision evidence. |
| Forensic | Pilot route | Allowed only through server-side P13 platform claim adapter and entitlement decision evidence. |
| Social Media | Pilot route | Allowed only through server-side P14 platform claim adapter and entitlement decision evidence. |
| Knowledge | Pilot route | Allowed only through server-side P15 platform claim adapter, explicit Knowledge entitlement, pre-retrieval scope filtering, citation filtering, and decision evidence. |

## Global Gate Results

| Gate | Rule | Required evidence | P12 result |
|---|---|---|---|
| G-SEC-001 | No active domain route appears in the platform app registry until that domain enforces platform claims server-side. | `apps/platform-api/src/app-registry.ts`, P8 DOPAMS/IQW adapter tests, P13 Forensic adapter tests, P14 Social Media adapter tests, P15 Knowledge adapter tests, `scripts/smoke-platform-local.sh`, `docs/spec/platform-local-deployment.md`. | Satisfied for DOPAMS, IQW, P13 Forensic, P14 Social Media, and P15 Knowledge pilot routes. |
| G-SEC-002 | Every platform allow/deny decision records claims snapshot, policy version, source/projection version, redaction decision, service path, outcome, and correlation ID. | `docs/spec/authorization-decision-evidence.md`, `packages/audit-ledger/src/decision-evidence.ts`, platform API decision tests, case360 authorization tests, Forensic platform-auth tests, Social Media platform-auth tests, Knowledge platform-auth tests. | Satisfied when P3/P6/P9/P13/P14/P15 checks and P12/P13/P14/P15 release checks pass. Missing evidence construction is a deny condition. |
| G-SEC-003 | Central evidence APIs do not return `storage_uri` by default. | `docs/spec/data-classification-policy.md`, evidence projection tests, case360 authz tests. | Satisfied for central platform evidence reads. Any future storage-location exposure requires a new contract and release gate amendment. |
| G-SEC-004 | Knowledge retrieval remains default-denied unless pre-retrieval scope filtering and citation filtering are proven by the P15 adapter. | `docs/spec/knowledge-runtime-decision.md`, `docs/spec/knowledge-retrieval-security.md`, `domains/knowledge/api/src/platform-auth.ts`, `domains/knowledge/api/src/platform-scope.ts`, Knowledge adapter tests, platform knowledge scope contract tests, selected RAG-app scope contract test. | Satisfied for the bounded P15 pilot route. `platform.knowledge.retrieve` still denies by default without adapter-controlled `knowledgeRetrievalEnabled`. |
| G-OPS-001 | Cutover and run-state governance are documented before any production pilot. | `docs/spec/cutover-governance-runbook.md`, `docs/spec/run-state-governance.md`, `docs/spec/traceability-matrix.md`. | Satisfied as an evidence package. Production cutover still requires human approval before the pilot is started. |

## Pipeline Gate Summary

| Pipeline gate | Covered phases | Required evidence | Release position |
|---|---|---|---|
| Gate-A Foundation and Policy Gate | P0-P4 | Source inventory, secret hygiene report, import map, auth claim contract, ABAC/threat model, decision evidence, synthetic fixtures. | Required before any pilot route. P12 depends on these artifacts remaining valid. |
| Gate-B Control Plane Contract Gate | P5-P7 | Shared packages, platform API registry and decision tests, platform web app launcher tests. | Required before platform shell exposure. Planned/blocked modules must not be launchable. |
| Gate-C Pilot Release Gate | P8-P16 | DOPAMS/IQW/Forensic/Social Media/Knowledge adapters, projection authorization tests, knowledge scoped retrieval and citation filtering, local integrated smoke test, P16 cutover readiness package, and governance approval package. | P16 verifies the readiness package and approval record for the full pilot route surface; production cutover waits for human approval. |

## Release Checks

The P12 release check is:

```sh
bash docs/spec/pipeline/checks/p12.sh
```

It covers the evidence documents, global gate traceability, operations governance coverage, phase traceability, root typecheck, platform API tests, platform web tests, and the local platform smoke script. The required command-level evidence for this gate is:

| Command | Required purpose | Latest P12 result |
|---|---|---|
| `npm run typecheck` | Root TypeScript workspace compatibility. | Passed on 2026-07-02. |
| `npm --workspace apps/platform-api run test` | Platform API registry, entitlement, decision, projection, fixture, and knowledge gate behavior. | Passed on 2026-07-02: 9 files, 32 tests. |
| `npm --workspace apps/platform-web run test` | Platform shell app launcher and blocked/planned state behavior. | Passed on 2026-07-02: 1 file, 5 tests. |
| `bash scripts/smoke-platform-local.sh` | Static or live integrated local deployment route safety. | Passed on 2026-07-02 using static profile checks because the live proxy was not running. |
| `bash docs/spec/pipeline/checks/p12.sh` | Full P12 release gate wrapper. | Passed on 2026-07-02 with GREEN P12 exit criteria. |

The P13 Forensic launch check is:

```sh
bash docs/spec/pipeline-p13/checks/p13.sh
```

P13 adds this command-level evidence:

| Command | Required purpose | Latest P13 result |
|---|---|---|
| `npm --workspace apps/forensic-api exec -- vitest run src/__tests__/platform-auth.test.ts` | Forensic server-side platform claim enforcement and decision evidence tests. | Passed on 2026-07-02: 1 file, 5 tests. |
| `npm --workspace apps/forensic-api run typecheck` | Forensic adapter TypeScript compatibility. | Passed on 2026-07-02. |
| `npm --workspace apps/platform-api run test` | Registry launch state and entitlement-gated Forensic launch behavior. | Passed on 2026-07-02: 9 files, 33 tests. |
| `npm --workspace apps/platform-web run test` | Platform shell launch rendering with Forensic pilot, Social Media planned, and Knowledge blocked. | Passed on 2026-07-02: 1 file, 5 tests. |
| `bash scripts/smoke-platform-local.sh` | Static or live integrated local route safety for DOPAMS, IQW, and Forensic only. | Passed on 2026-07-02 using static profile checks because the live proxy was not running. |

The P14 Social Media launch check is:

```sh
bash docs/spec/pipeline-p14/checks/p14.sh
```

P14 adds this command-level evidence:

| Command | Required purpose | Latest P14 result |
|---|---|---|
| `npm --workspace apps/social-media-api exec -- vitest run src/__tests__/platform-auth.test.ts` | Social Media server-side platform claim enforcement and decision evidence tests. | Passed on 2026-07-02: 1 file, 5 tests. |
| `npm --workspace apps/social-media-api run typecheck` | Social Media adapter TypeScript compatibility. | Passed on 2026-07-02. |
| `npm --workspace apps/platform-api run test` | Registry launch state and entitlement-gated Social Media launch behavior while Knowledge remains blocked. | Passed on 2026-07-02: 9 files, 34 tests. |
| `npm --workspace apps/platform-web run test` | Platform shell launch rendering with Social Media pilot and Knowledge blocked. | Passed on 2026-07-02: 1 file, 5 tests. |
| `bash scripts/smoke-platform-local.sh` | Static or live integrated local route safety for DOPAMS, IQW, Forensic, and Social Media while Knowledge remains blocked. | Passed on 2026-07-02 using static profile checks because the live proxy was not running. |

The P15 Knowledge launch check is:

```sh
bash docs/spec/pipeline-p15/checks/p15.sh
```

P15 adds this command-level evidence:

| Command | Required purpose | Latest P15 result |
|---|---|---|
| `npm --workspace domains/knowledge/api run test` | Knowledge server-side platform claim enforcement, default ABAC deny, scoped search, and citation filtering tests. | Passed on 2026-07-02: 1 file, 13 tests. |
| `npm --workspace domains/knowledge/api run typecheck` | Knowledge adapter TypeScript compatibility. | Passed on 2026-07-02. |
| `npm --workspace packages/authz run test` | ABAC deny-by-default behavior and entitlement regressions. | Passed on 2026-07-02: 4 files, 27 tests. |
| `npm --workspace apps/platform-api run test` | Registry launch state and entitlement-gated Knowledge launch behavior. | Passed on 2026-07-02: 9 files, 35 tests. |
| `npm --workspace apps/platform-web run test` | Platform shell launch rendering with Knowledge pilot. | Passed on 2026-07-02: 1 file, 5 tests. |
| `cd /Users/n15318/RAG-app && npm --workspace apps/api exec -- vitest run src/__tests__/retrieval/platform-scope-contract.test.ts` | Selected runtime scope/citation contract remains green without editing RAG-app. | Required by P15. |
| `bash scripts/smoke-platform-local.sh` | Static or live integrated local route safety for DOPAMS, IQW, Forensic, Social Media, and Knowledge. | Passed on 2026-07-02 using static profile checks because the live proxy was not running. |

The P16 pilot cutover readiness check is:

```sh
bash docs/spec/pipeline-p16/checks/p16.sh
```

P16 adds this command-level evidence:

| Command | Required purpose | Latest P16 result |
|---|---|---|
| `node scripts/check-pilot-cutover-readiness.mjs` | Machine-check consistency across approval JSON, local deployment docs, cutover runbook, release gate, run-state governance, traceability, manifest, registry, proxy, and smoke script. | Required by P16. |
| `bash docs/spec/pipeline-p15/checks/p15.sh` | Prove the predecessor safety gate remains green before readiness is considered. | Required by P16. |
| `bash docs/spec/pipeline-p16/checks/p16.sh` | Full P16 readiness wrapper. | Required by P16; parks at human gate after GREEN. |

## Stop Conditions

The release is No-Go if any of these conditions are observed:

- a planned or blocked app has an active launch URL or proxy route;
- DOPAMS, IQW, Forensic, or Social Media can be launched without server-side platform claim enforcement;
- case or evidence reads can return data without complete decision evidence;
- central evidence APIs return `storage_uri` by default;
- Knowledge retrieval can run through the platform UI or API without the P15 adapter proving server-side claims, scoped retrieval, and citation filtering;
- legal hold, audit continuity, emergency revocation, incident response, access review, or stale projection remediation cannot be executed;
- rollback would remove or weaken original domain app access, domain-local auth, or existing audit trails.

## Production Approval Record

| Approval | Required owner | Required before | Status |
|---|---|---|---|
| Release approval | Platform release owner | Production pilot cutover | Required; not granted by this document. |
| Security and risk acceptance | Security/risk owner | Production pilot cutover | Required; not granted by this document. |
| DOPAMS pilot participation | DOPAMS domain owner | DOPAMS route exposure | Required; not granted by this document. |
| IQW pilot participation | IQW domain owner | IQW route exposure | Required; not granted by this document. |
| Forensic pilot participation | Forensic domain owner | Forensic route exposure | Required; not granted by this document. |
| Social Media pilot participation | Social Media domain owner | Social Media route exposure | Required; not granted by this document. |
| Knowledge pilot participation | Knowledge/RAG domain owner | Knowledge route exposure | Required; not granted by this document. |
| Legal hold and audit continuity | Legal/audit owner | Any pilot case or evidence projection | Required; not granted by this document. |
| Run-state operations | Operations owner | Pilot day-0 start | Required; not granted by this document. |

The machine-readable approval record is `docs/spec/pilot-cutover-approval.json`. P16 requires every role in that file to remain `pending`; human approval must happen outside the automated phase.

## Accepted Residual Risks

| Risk | Treatment | Owner | Review date |
|---|---|---|---|
| P11 local profile is a pilot proof, not production security evidence. | Production must use real identity provider verification, managed secrets, TLS, service authentication, and production audit sinks before cutover. | Operations owner | 2026-07-02 |
| Source repos were dirty at P0 and local sensitive paths existed outside the import allowlist. | Import allowlist and secret-path scanners quarantine selected scope; active secret rotation remains an external owner task. | Security/risk owner | 2026-07-02 |
| Knowledge is enabled only as a bounded P15 pilot route, not production-approved RAG operation. | Keep production approval human-gated; do not ingest real corpus data; preserve default-deny ABAC outside the P15 adapter path. | Platform release owner | 2026-07-02 |
| Forensic is enabled as a P13 platform-launched pilot route, not production-approved cutover. | Keep production approval human-gated; preserve direct Forensic domain auth as bootstrap and require server-side platform claims for platform-launched requests. | Forensic domain owner | 2026-07-02 |
| Social Media is enabled as a P14 platform-launched pilot route, not production-approved cutover. | Keep production approval human-gated; preserve direct Social Media domain auth as bootstrap and require server-side platform claims for platform-launched requests. | Social Media domain owner | 2026-07-02 |
| P16 verifies readiness evidence but cannot approve production pilot cutover. | Keep `docs/spec/pilot-cutover-approval.json` pending until human owners sign in the release/change record. | Platform release owner | 2026-07-02 |
