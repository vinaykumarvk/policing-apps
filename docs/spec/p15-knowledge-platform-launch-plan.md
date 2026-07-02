# P15 Knowledge Platform Adapter and Pilot Launch Plan

Version: 1.0  
Date: 2026-07-02  
Process path: standard extension to the full policing-platform pipeline  
Pipeline harness: `docs/spec/pipeline-p15`

## Objective

Enable Knowledge Search as a bounded platform-launched pilot route only after the platform can prove:

- server-side platform claims are required;
- an explicit Knowledge entitlement is required;
- `platform.knowledge.retrieve` remains deny-by-default unless a Knowledge adapter enables scoped retrieval;
- pre-retrieval scope filtering happens before vector, graph, lexical, or wiki search;
- citations are filtered before response;
- allow and deny decisions produce decision evidence;
- local routing exposes Knowledge only through the pilot platform proxy.

P15 extends P13/P14. It does not approve production cutover and does not modify the parked P12, P13, or P14 human approval tokens.

## Current State

| Surface | Current state before P15 | Required P15 state |
|---|---|---|
| DOPAMS | Pilot route, P8 adapter evidence | Preserve unchanged |
| IQW | Pilot route, P8 adapter evidence | Preserve unchanged |
| Forensic | Pilot route, P13 adapter evidence | Preserve unchanged |
| Social Media | Pilot route, P14 adapter evidence | Preserve unchanged |
| Knowledge | Blocked, no launch URL, RAG-app selected but route disabled | Bounded pilot route gated by P15 adapter evidence |

## P15 Scope

1. Add a monorepo Knowledge API adapter under `domains/knowledge/api`.
2. Import or mirror the selected RAG-app platform scope contract into the Knowledge adapter boundary.
3. Add Knowledge platform-auth and scope/citation tests covering allow and deny paths.
4. Preserve deny-by-default ABAC behavior for `platform.knowledge.retrieve`; only the Knowledge adapter may opt into enabled scoped retrieval.
5. Add a Knowledge entitlement to the synthetic `io` claim fixture.
6. Mark Knowledge `pilot` in the platform app registry only after P15 evidence exists.
7. Expose `/domains/knowledge` in the local pilot profile using a synthetic Knowledge-capable claim.
8. Update platform API/web tests and local smoke checks.
9. Update release gate, run-state governance, traceability, and manifest evidence.

## Out Of Scope

- Production RAG deployment, Cloud Run changes, DNS/domain mapping, or production credentials.
- Real sensitive case ingestion, uploads, court data, or live RAG corpora.
- Broad RAG-app import beyond the bounded platform adapter contract needed for P15.
- Destructive DB operations, schema migrations, or irreversible data movement.
- Weakening claim validation, MFA, jurisdiction, clearance, assignment, redaction, or citation requirements.
- Removing default `platform.knowledge.retrieve` deny behavior outside the P15 adapter path.

## Entitlement Contract

P15 uses the existing `io` fixture in `docs/spec/auth-claim-fixtures.json`, amended with Knowledge capability.

Required Knowledge entitlement:

| Field | Value |
|---|---|
| module | `knowledge` |
| domain | `knowledge` |
| permission | `query:case-summary` |
| org_id | `mohali-district` |
| unit_id | `narcotics-cell-mohali` |
| jurisdiction | `IN / PB / SAS Nagar / Phase-8` |
| requiredClearance | `confidential` |
| assignment | `case_id: CASE-DOPAMS-001` |
| purpose | `case_review` |
| requireMfa | `true` |

## Functional Requirements

### P15-R-SEC-001: Knowledge Platform Adapter

The Knowledge API must include a server-side platform adapter that:

- accepts only server-verified platform claims for platform-launched requests;
- evaluates the P15 entitlement contract using `@policing-platform/authz`;
- denies missing, malformed, unverified, stale, revoked, wrong-module, wrong-jurisdiction, wrong-clearance, wrong-assignment, and wrong-purpose claims;
- records decision evidence containing adapter version, gate evidence ref, policy version, service path, outcome, reason, correlation ID, source version, snapshot/projection version, redaction decision, server verification, audit timestamp, and claim snapshot when available.

### P15-R-KNOW-001: Scoped Retrieval Before Search

The Knowledge adapter must build a pre-retrieval scope before any vector, graph, lexical, wiki, cache, or answer-generation path receives candidates. Candidate metadata without an allow decision, active source status, fresh projection, safe redaction, matching jurisdiction, matching assignment, and allowed clearance must be dropped before search.

The selected RAG-app platform-scope contract must remain green:

```sh
cd /Users/n15318/RAG-app
npm --workspace apps/api exec -- vitest run src/__tests__/retrieval/platform-scope-contract.test.ts
```

### P15-R-KNOW-002: Citation Filtering Before Response

Generated citations must be filtered before response. Any citation not in the scoped allowed set must be dropped and audited. If no citations remain, the adapter must return a no-answer/deny-safe response instead of returning an unsupported answer.

### P15-R-ABAC-001: Default Deny Preserved

`platform.knowledge.retrieve` must remain denied by default. The P15 adapter may enable retrieval only through an explicit option or adapter-controlled path after claim, entitlement, scope, redaction, and citation checks pass.

### P15-R-REG-001: Entitlement-Gated Launch

The platform app registry must mark Knowledge as `pilot` with `/domains/knowledge` only after P15 adapter evidence is present. The launch URL must be returned only to a platform claim that satisfies the Knowledge entitlement request.

DOPAMS, IQW, Forensic, and Social Media pilot states must remain valid.

### P15-R-OPS-001: Local Pilot Route

The local deployment profile must expose `/domains/knowledge` through the local proxy with a synthetic Knowledge-capable platform claim. The route must call a local Knowledge gate harness and return `200` only when the P15 adapter allows the claim and produces scoped/citation-filtered evidence.

### P15-R-TRACE-001: Evidence and Traceability

P15 must update:

- `docs/spec/manifest.json`;
- `docs/spec/release-gate.md`;
- `docs/spec/run-state-governance.md`;
- `docs/spec/traceability-matrix.md`.

The manifest must record P15 status, evidence files, checks, token accounting, and requirement-to-evidence mappings.

## Implementation Steps

1. Read this plan, P10 Knowledge docs, P13/P14 launch patterns, app registry, auth fixtures, ABAC implementation, RAG-app scope contract, local compose/nginx, smoke script, and manifest.
2. Create `domains/knowledge/api` with a small TypeScript package, Knowledge platform adapter, scope/citation helpers, and tests.
3. Amend `packages/authz/src/abac.ts` so `platform.knowledge.retrieve` is deny-by-default but can be explicitly enabled by the Knowledge adapter.
4. Add Knowledge module/domain permission to the `io` claim fixture and update tests only where existing exact expectations require it.
5. Update platform registry and related platform API/web tests for Knowledge pilot launch and entitlement-only visibility.
6. Update local compose, nginx, and smoke script for Knowledge pilot routing.
7. Update governance and traceability documents.
8. Update manifest P15 execution evidence.
9. Run the P15 oracle and repair only P15 implementation/evidence gaps.

## Exit Criteria

P15 is green only when this command succeeds:

```sh
bash docs/spec/pipeline-p15/checks/p15.sh
```

That wrapper verifies:

- required P15 artifacts exist;
- Knowledge adapter, scope helpers, and app registry include P15 evidence refs;
- ABAC has default-safe Knowledge enablement;
- Knowledge claim fixture and registry entitlement are present;
- DOPAMS, IQW, Forensic, and Social Media gates are preserved;
- manifest parses and records P15 complete;
- Knowledge API adapter tests and typecheck pass;
- authz, platform API, and platform web tests pass;
- selected RAG-app platform scope contract test passes;
- local smoke script passes.

## Rollback

Rollback is to remove the Knowledge registry launch URL and local proxy route, then return Knowledge to `blocked` with no launch URL and `KNOWLEDGE_RETRIEVAL_DISABLED`. The adapter and tests may remain as non-active evidence, but the route must not be exposed unless the gate passes again.

## Human Gate

P15 remains `gate: human`. The automated oracle can prove implementation evidence, but it cannot approve production RAG operation, legal risk acceptance, real corpus ingestion, or operational go-live.
