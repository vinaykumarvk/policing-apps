# P13 Forensic Platform Launch Plan

Version: 1.0
Generated at: 2026-07-02T12:22:00+05:30
Pipeline: `docs/spec/pipeline-p13`
Classification: full slice, because this enables a regulated policing domain route through the shared platform.

## Objective

Enable the Forensic app as a platform-launched pilot module from the Policing Platform shell while preserving the global security gates from P0-P12.

P13 must prove that Forensic is launchable only when the Forensic API enforces server-verified platform claims server-side and records allow/deny decision evidence. P13 must not enable Social Media or Knowledge.

## Current Blocker

Forensic is currently `planned` in the platform registry, has no `launch_url`, and has a pending platform claim gate. The release gate forbids active routes for planned or blocked apps. P13 removes only the Forensic blocker by adding the same class of server-side adapter evidence already used for DOPAMS and IQW.

## Scope

In scope:

- Add `apps/forensic-api/src/middleware/platform-auth.ts`.
- Register the Forensic platform auth middleware in `apps/forensic-api/src/app.ts`.
- Add targeted Forensic platform-auth tests.
- Update the platform app registry so Forensic is `pilot`, server-side gate passed, and launch URL is `/domains/forensic`.
- Add Forensic local proxy/compose route evidence.
- Update local smoke checks so Forensic returns `200` while Social Media and Knowledge remain blocked.
- Update release/traceability/governance documentation and `docs/spec/manifest.json` with P13 evidence.

Out of scope:

- Social Media launch.
- Knowledge Search launch or retrieval.
- Production deployment.
- Destructive database operations or new migrations.
- Real forensic evidence ingestion.
- Weakening P12 production approval requirements.

## Requirements

| ID | Requirement | Verification |
|---|---|---|
| P13-R-SEC-001 | Forensic platform-launched requests require server-verified platform claims. | Missing, malformed, unverified, stale, revoked, wrong-module, wrong-jurisdiction, wrong-clearance, and wrong-assignment tests deny. |
| P13-R-SEC-002 | Direct Forensic local/domain auth remains available as bootstrap but cannot satisfy platform-launched authorization. | Middleware test proves platform launch without platform claims returns 403 while direct route without platform headers is not governed by the adapter. |
| P13-R-SEC-003 | Every Forensic platform allow/deny creates decision evidence with gate ref, policy version, service path, outcome, reason, correlation ID, source version, projection version, redaction decision, server verification state, and claim snapshot when valid. | Unit tests assert evidence fields on allow and deny paths. |
| P13-R-REG-001 | Platform registry marks Forensic as launchable only after server-side gate evidence is present. | Platform API app registry tests and P13 check inspect registry state. |
| P13-R-OPS-001 | Local integrated profile routes DOPAMS, IQW, and Forensic only; Social Media and Knowledge remain blocked. | `scripts/smoke-platform-local.sh` static/live checks. |
| P13-R-TRACE-001 | Release gate, traceability matrix, run-state governance, and manifest record P13 evidence and residual risks. | P13 check verifies docs and manifest references. |

## Implementation Steps

1. Model Forensic entitlement:
   - module/domain: `forensic`
   - permission: `evidence:metadata-read`
   - org: `forensic-lab`
   - unit: `digital-forensics`
   - jurisdiction: IN/PB/SAS Nagar
   - clearance: `secret`
   - assignment: `EVID-DOPAMS-001`
   - purpose: `forensic_review`
   - MFA required.
2. Create Forensic platform auth adapter using existing DOPAMS adapter conventions.
3. Register the adapter immediately after existing Forensic auth middleware, before audit/logging and domain routes.
4. Add targeted tests using `forensic-analyst` fixture and negative personas/claim variants.
5. Update platform app registry Forensic entry from planned to pilot.
6. Update local deployment:
   - add Forensic gate harness in compose;
   - add `/domains/forensic/*` route in nginx;
   - keep Social Media and Knowledge blocked.
7. Update smoke checks and docs.
8. Update `docs/spec/manifest.json` with P13 status, evidence, checks, traceability, and token accounting.

## Exit Criteria

The P13 independent oracle is:

```sh
bash docs/spec/pipeline-p13/checks/p13.sh
```

It must pass:

- required P13 artifacts exist;
- Forensic registry is `pilot` with `/domains/forensic` launch URL;
- Social Media remains `planned` without a launch URL;
- Knowledge remains `blocked` without a launch URL;
- Forensic platform auth tests pass;
- Forensic typecheck passes;
- platform API and platform web tests pass;
- local smoke script passes;
- manifest records P13.

## Gate

P13 is `gate: human`. The check can prove implementation evidence, but human release approval is still required before treating Forensic as production-pilot approved.

## Rollback

Rollback is non-destructive:

1. Revert Forensic registry state to `planned` and remove `/domains/forensic` launch URL.
2. Remove `/domains/forensic/*` proxy route from local profile.
3. Keep the Forensic adapter code and tests if useful, but disable route exposure until a later approval.
4. Rerun P13 check to confirm Forensic is no longer active, or rerun the P12 release gate if returning to the prior release scope.

