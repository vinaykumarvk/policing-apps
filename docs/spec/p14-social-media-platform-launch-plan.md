# P14 Social Media Platform Adapter and Pilot Launch Plan

Version: 1.0  
Date: 2026-07-02  
Process path: standard extension to the full policing-platform pipeline  
Pipeline harness: `docs/spec/pipeline-p14`

## Objective

Enable Social Media Intelligence as a platform-launched pilot route while preserving the global platform release gates:

- every active domain route requires server-side platform claim enforcement;
- every allow/deny decision records decision evidence;
- planned or blocked apps do not expose launch URLs;
- Knowledge Search remains blocked until scoped retrieval and citation filtering are proven in a later approved phase.

P14 extends the platform after P13. It does not approve production cutover and does not modify P12 or P13 human approval tokens.

## Current State

| Surface | Current state before P14 | Required P14 state |
|---|---|---|
| DOPAMS | Pilot route, P8 adapter evidence | Preserve unchanged |
| IQW | Pilot route, P8 adapter evidence | Preserve unchanged |
| Forensic | Pilot route, P13 adapter evidence | Preserve unchanged |
| Social Media | Planned, no launch URL, no proxy route | Pilot route gated by P14 adapter evidence |
| Knowledge | Blocked, no launch URL, no retrieval route | Preserve blocked |

## P14 Scope

P14 is intentionally narrow:

1. Add Social Media API server-side platform claim evaluation.
2. Add targeted Social Media platform-auth tests.
3. Register Social Media middleware after domain auth and before route handling/audit-sensitive work.
4. Mark Social Media as pilot in the platform app registry only after the adapter evidence exists.
5. Expose `/domains/social-media` in the local pilot profile using a synthetic analyst claim.
6. Update smoke checks so DOPAMS, IQW, Forensic, and Social Media are pilot routes while Knowledge stays blocked.
7. Update release gate, run-state governance, traceability, and manifest evidence.

## Out Of Scope

- Knowledge Search launch or `platform.knowledge.retrieve` enablement.
- Production credentials, production Cloud Run updates, or domain mapping changes.
- Real social-media data ingestion, screenshots, OSINT exports, or connector credentials.
- Database migrations or destructive database operations.
- Rewriting Social Media domain authorization.
- Weakening existing DOPAMS, IQW, or Forensic gates.

## Entitlement Contract

P14 uses the existing `analyst` fixture in `docs/spec/auth-claim-fixtures.json`.

Required Social Media entitlement:

| Field | Value |
|---|---|
| module | `social_media` |
| domain | `social_media` |
| permission | `content:metadata-read` |
| org_id | `state-intelligence` |
| unit_id | `analysis-cell` |
| jurisdiction | `IN / PB / SAS Nagar` |
| requiredClearance | `confidential` |
| assignment | `queue_id: analysis-state-feed` |
| purpose | `intelligence_analysis` |
| requireMfa | `true` |

## Functional Requirements

### P14-R-SEC-001: Social Media Platform Adapter

The Social Media API must include a server-side platform auth adapter that:

- accepts only server-verified platform claims for platform-launched requests;
- evaluates the P14 entitlement contract above using `@policing-platform/authz`;
- denies missing, malformed, unverified, stale, revoked, wrong-module, wrong-jurisdiction, wrong-clearance, wrong-assignment, and wrong-purpose claims;
- records decision evidence containing adapter version, gate evidence ref, policy version, service path, outcome, reason, correlation ID, source version, projection version, redaction decision, server verification, local-auth requirement, audit timestamp, and claim snapshot when available.

### P14-R-SEC-002: No Local Auth Bypass

Existing Social Media local/domain auth may remain available as bootstrap for direct domain access, but platform-launched Social Media routes must not be allowed by local auth alone. Platform-launched requests require Social Media platform decision evidence.

### P14-R-REG-001: Entitlement-Gated Launch

The platform app registry must mark Social Media as `pilot` with `/domains/social-media` only after P14 adapter evidence is present. The launch URL must be returned only to a platform claim that satisfies the Social Media entitlement request.

Knowledge must remain `blocked` with no launch URL. DOPAMS, IQW, and Forensic pilot state must remain valid.

### P14-R-OPS-001: Local Pilot Route

The local deployment profile must expose `/domains/social-media` through the local proxy with a synthetic analyst platform claim. The route must call a local Social Media gate harness and return `200` only when the P14 adapter allows the claim.

The local profile must keep `/domains/knowledge` returning `404`.

### P14-R-TRACE-001: Evidence and Traceability

P14 must update:

- `docs/spec/manifest.json`;
- `docs/spec/release-gate.md`;
- `docs/spec/run-state-governance.md`;
- `docs/spec/traceability-matrix.md`.

The manifest must record P14 status, evidence files, checks, and requirement-to-evidence mappings.

## Implementation Steps

1. Read the P14 plan, P13 implementation, current registry, Social Media auth middleware, local deployment profile, smoke script, and manifest.
2. Implement `apps/social-media-api/src/middleware/platform-auth.ts`.
3. Add `apps/social-media-api/src/__tests__/platform-auth.test.ts`.
4. Add `@policing-platform/authz` to `apps/social-media-api/package.json` and update `package-lock.json`.
5. Register the Social Media platform auth middleware in `apps/social-media-api/src/app.ts`.
6. Update platform registry and related platform API/web tests.
7. Update local compose, nginx, and smoke script for Social Media pilot routing.
8. Update governance and traceability documents.
9. Update manifest P14 execution evidence.
10. Run the P14 oracle and repair only P14 implementation/evidence gaps.

## Exit Criteria

P14 is green only when this command succeeds:

```sh
bash docs/spec/pipeline-p14/checks/p14.sh
```

That wrapper verifies:

- required P14 artifacts exist;
- Social Media adapter and app registration include P14 evidence refs;
- registry marks Social Media pilot and keeps Knowledge blocked;
- manifest parses and records P14 complete;
- Social Media adapter tests pass;
- Social Media typecheck passes;
- platform API tests pass;
- platform web tests pass;
- local smoke script passes.

## Rollback

Rollback is to remove the Social Media registry launch URL and local proxy route, then return Social Media to `planned` with no launch URL. The adapter and tests may remain as non-active evidence, but the route must not be exposed unless the gate passes again.

## Human Gate

P14 remains `gate: human`. The automated oracle can prove implementation evidence, but it cannot approve production pilot operation, legal risk acceptance, or operational go-live.
