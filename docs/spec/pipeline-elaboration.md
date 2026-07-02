# Plan To Pipeline Elaboration

Status: expanded with the Codex `$plan-to-pipeline` skill after converting it from the Claude Code skill. The generated execution harness lives in `docs/spec/pipeline/`.

## Inputs

- Architecture source: `docs/discovery/policing-platform/holistic-architecture.md`
- Execution plan: `docs/spec/policing-platform-integration-execution-plan.md`
- Adversarial council report: `doc/evaluations/policing-platform-integration-council-report-20260702-000617.md`
- Final phased plan: `docs/spec/phased-plan.yaml`
- Machine manifest: `docs/spec/manifest.json`
- Execution harness: `docs/spec/pipeline/phases.yaml`

## Pipeline Classification

Path: `full`

Reason: this is a regulated, data-sensitive consolidation that touches authentication, authorization, case data, evidence metadata, auditability, knowledge retrieval, deployment topology, and operational cutover.

Selected strategy: `platform-shell-over-bounded-services`

Release 1 does not attempt to merge all apps into one code path. It proves the platform control plane with DOPAMS and IQW as pilot domains while keeping Social Media, Forensic, and Knowledge routes planned or blocked until their server-side authorization gates pass.

## Gate Model

Gate A: Foundation and Policy Gate

- Covers phases: `P0` through `P4`
- Required evidence: source inventory, secret hygiene report, deterministic import map, auth claim contract, ABAC policy, data classification policy, authorization decision evidence schema, synthetic pilot fixtures.
- Exit rule: no code import or active app route proceeds if secrets, unresolved auth ambiguity, or missing deny-by-default policy remains.

Gate B: Control Plane Contract Gate

- Covers phases: `P5` through `P7`
- Required evidence: shared package tests, platform API app registry tests, entitlement check tests, decision evidence tests, platform shell E2E tests.
- Exit rule: planned or blocked modules must not emit launch URLs, and all active routes must be backed by server-side platform claim enforcement.

Gate C: Pilot Release Gate

- Covers phases: `P8` through `P12`
- Required evidence: DOPAMS and IQW auth adapter tests, projection authorization tests, evidence metadata redaction tests, knowledge runtime decision, integrated local smoke test, cutover governance, run-state governance, traceability matrix.
- Exit rule: the pilot cannot release if unauthorized app, case, evidence, or knowledge access is possible, or if allow/deny decisions cannot be reconstructed from audit evidence.

## Execution Envelopes

### Goal 1: Foundation Inventory

Objective: freeze source scope, remove import risk, and produce the target monorepo layout.

Context: `policing-apps`, `compliant-parser`, `RAG-app`, source inventory, current discovery architecture.

Constraints: do not import real secrets, rewrite source histories, or perform destructive cleanup.

Freedom: choose import checksum format, inventory template, and monorepo workspace layout that preserves current app run commands where practical.

Evidence required: `docs/spec/source-inventory.md`, `docs/spec/secret-hygiene-report.md`, `docs/spec/import-map.yaml`, layout checks.

Escalate when: real secrets are detected, source ownership is ambiguous, or an included repo contains active data that should not enter the platform repo.

Mapped phases: `P0`, `P1`

### Goal 2: Authorization Control Plane

Objective: define platform claims, entitlements, ABAC, field classification, and immutable decision evidence before app exposure.

Context: existing auth patterns, pilot personas, DOPAMS and IQW access needs, police data classification assumptions.

Constraints: deny by default, no UI-only authorization, no route activation without server-side checks, no production `any` or swallowed auth errors.

Freedom: choose TypeScript package boundaries and Python fixture format as long as cross-runtime fixtures stay versioned and equivalent.

Evidence required: claim fixture tests, ABAC negative tests, decision evidence tests, data classification policy.

Escalate when: jurisdiction, assignment, legal hold, clearance, or purpose-of-use semantics cannot be resolved from existing artifacts.

Mapped phases: `P2`, `P3`, `P4`, `P5`

### Goal 3: Platform API and Shell

Objective: create the central platform entrypoint, app registry, entitlement checks, health endpoints, and web shell.

Context: shared service packages, app registry states, pilot domains, existing frontend conventions.

Constraints: planned and blocked modules must not include active launch URLs; the web shell must not calculate entitlements locally.

Freedom: choose API route organization, UI component names, and health aggregation details inside the approved contracts.

Evidence required: platform API tests, app registry tests, entitlement tests, web shell tests, app launcher E2E.

Escalate when: an active route can be rendered or called before the backing domain has passed server-side platform claim validation.

Mapped phases: `P6`, `P7`

### Goal 4: Pilot Domain Integration

Objective: connect DOPAMS and IQW to the platform using server-side platform claim validation and audited launch paths.

Context: DOPAMS TypeScript services, IQW FastAPI services, cross-runtime fixtures, app registry.

Constraints: local/domain auth may remain only as audited bootstrap or break-glass; platform-launched routes must emit decision evidence.

Freedom: implement adapters in each runtime using idiomatic middleware while keeping the claim contract common.

Evidence required: DOPAMS platform auth tests, IQW platform auth tests, revocation tests, wrong module and wrong jurisdiction tests.

Escalate when: either runtime cannot enforce platform claims without bypassing existing domain security or weakening local auth.

Mapped phases: `P8`

### Goal 5: Case, Evidence, and Knowledge Governance

Objective: create pilot case and evidence metadata projections and make a controlled knowledge runtime decision.

Context: pilot case/evidence fixtures, DOPAMS/IQW source records, knowledge runtime comparison criteria.

Constraints: source systems remain authoritative, central evidence responses exclude `storage_uri` by default, stale or missing source state degrades deterministically, knowledge UI remains disabled until scoped retrieval is proven.

Freedom: choose projection service internals and runtime comparison scoring, provided audit, redaction, and traceability requirements are met.

Evidence required: case projection tests, evidence projection tests, case360 authorization tests, knowledge runtime decision, retrieval scope tests.

Escalate when: evidence links expose storage locations, retention/legal hold rules conflict, or scoped retrieval cannot be proven before vector or graph search.

Mapped phases: `P9`, `P10`

### Goal 6: Integrated Pilot Release

Objective: provide one local integrated deployment profile and complete the operational release gate.

Context: platform web/API, DOPAMS, IQW, Postgres/pgvector, object storage, Redis/queue, reverse proxy, cutover expectations.

Constraints: local compose is only a pilot proof, blocked modules are not routable, production pilot requires run-state governance.

Freedom: choose compose service names, proxy paths, and smoke command shape as long as the pilot is reproducible and auditable.

Evidence required: local smoke test, pilot E2E, release gate report, cutover runbook, run-state governance, traceability matrix.

Escalate when: rollback would lose audit continuity, active investigations cannot be transitioned safely, emergency revocation is missing, or smoke tests pass while blocked modules remain routable.

Mapped phases: `P11`, `P12`

## Parallelism

- `P0`, `P2`, and `P3` can start together for inventory and control-plane contract drafting, but imports wait for secret hygiene.
- `P6` and `P7` can scaffold together after package contracts exist, but launch paths remain inactive until `P8` passes.
- `P8` and `P9` can overlap only after pilot fixtures and ABAC policies are stable.
- `P10` can run in parallel with pilot adapter work because Release 1 keeps knowledge disabled unless the security proof is complete.

## Review Cadence

- After Gate A: review source scope, auth semantics, ABAC, and classification before writing integration code.
- After Gate B: review platform API/shell behavior, app registry launch safety, and audit evidence completeness.
- After Gate C: run release readiness review with security, operations, and data governance evidence in one packet.

## Next Execution Goal

Start with `P0` through `P4` as the first bounded goal. Stop at Gate A with evidence before importing code into the target structure or exposing any active route through the platform.
