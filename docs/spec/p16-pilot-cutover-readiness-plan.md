# P16 Pilot Cutover Readiness Plan

Version: 1.0  
Date: 2026-07-02  
Depends on: P15 Knowledge Platform Adapter and Pilot Launch  
Pipeline: `docs/spec/pipeline-p16/`

## Objective

Create the pilot cutover readiness package for the consolidated policing platform after DOPAMS, IQW, Forensic, Social Media, and Knowledge have all reached bounded platform-launched pilot state. P16 does not approve production cutover. It makes the evidence, route scope, local operating profile, rollback path, and human approval record explicit and machine-checkable.

## Scope

P16 covers the handoff from technical launch gates to operational pilot readiness:

- update local deployment documentation so it matches the P15 route surface instead of the older DOPAMS/IQW-only profile;
- update cutover governance so every currently launchable pilot domain has an owner, rollback path, and approval requirement;
- create a machine-readable cutover approval record with all approvals pending;
- add a readiness checker that validates docs, manifest, approval record, registry, route profile, and smoke evidence are synchronized;
- update release gate, run-state governance, traceability, and manifest with P16 evidence;
- preserve all P0-P15 security controls by rerunning the P15 oracle as part of P16 verification.

## Non-Scope

P16 must not:

- grant production approval or mark any human approval as complete;
- add production credentials, managed secrets, TLS certificates, provider keys, or real identity-provider configuration;
- ingest real case, evidence, social media, forensic, or knowledge corpus data;
- change database schemas, migrations, or destructive operations;
- weaken ABAC, entitlement, platform-claim validation, decision evidence, route gating, or the P15 Knowledge default-deny behavior.

## Expected Files

- `docs/spec/p16-pilot-cutover-readiness-plan.md`
- `docs/spec/pilot-cutover-approval.json`
- `scripts/check-pilot-cutover-readiness.mjs`
- `docs/spec/platform-local-deployment.md`
- `docs/spec/cutover-governance-runbook.md`
- `docs/spec/release-gate.md`
- `docs/spec/run-state-governance.md`
- `docs/spec/traceability-matrix.md`
- `docs/spec/manifest.json`
- `docs/spec/pipeline-p16/phases.yaml`
- `docs/spec/pipeline-p16/prompts/P16.md`
- `docs/spec/pipeline-p16/checks/p16.sh`
- `docs/spec/pipeline-p16/README.md`

## Detailed Execution Plan

1. Read current P12-P15 release evidence.
   - Inspect `docs/spec/release-gate.md`, `docs/spec/run-state-governance.md`, `docs/spec/cutover-governance-runbook.md`, `docs/spec/platform-local-deployment.md`, `docs/spec/traceability-matrix.md`, and `docs/spec/manifest.json`.
   - Confirm current launchable pilot domains from `apps/platform-api/src/app-registry.ts`: DOPAMS, IQW, Forensic, Social Media, and Knowledge.
   - Confirm `bash docs/spec/pipeline-p15/checks/p15.sh` remains the predecessor safety gate.

2. Author the P16 approval record.
   - Create `docs/spec/pilot-cutover-approval.json`.
   - Use schema version `platform.pilot_cutover_approval.v1`.
   - Mark `phase` as `P16`.
   - Mark `approval_status` as `pending_human_approval`.
   - Include required approval roles: platform release owner, security/risk owner, DOPAMS owner, IQW owner, Forensic owner, Social Media owner, Knowledge/RAG owner, legal/audit owner, and operations owner.
   - Keep every approval status as `pending`; do not set `approved_at`.
   - Include required gate commands and route surfaces as evidence references.

3. Update local deployment documentation.
   - Update `docs/spec/platform-local-deployment.md` from the older DOPAMS/IQW-only profile to the P16 profile.
   - Document all platform routes and smoke personas:
     - default local pilot claim launches DOPAMS and IQW;
     - forensic smoke persona launches Forensic;
     - analyst/social-media smoke persona launches Social Media;
     - knowledge smoke persona launches Knowledge;
     - non-entitled personas do not receive unrelated launch URLs.
   - Keep local limitations explicit: synthetic claims only, no production credentials, no production security claim.

4. Update cutover governance.
   - Update `docs/spec/cutover-governance-runbook.md` to cover all five pilot domains.
   - Add approval requirements for Forensic, Social Media, and Knowledge/RAG owners.
   - Update pre-cutover checklist, live smoke checks, rollback sequence, emergency revocation, and incident response references.
   - State that production cutover is still No-Go until all approval record roles are completed outside this phase.

5. Add machine-readable readiness checker.
   - Create `scripts/check-pilot-cutover-readiness.mjs`.
   - Validate approval JSON parses and keeps all approvals pending.
   - Validate docs mention every pilot domain and `/domains/*` route.
   - Validate app registry contains P8/P13/P14/P15 evidence refs and active routes.
   - Validate nginx and smoke script include all route surfaces and smoke personas.
   - Validate release gate/run-state governance reference P16 or successor gate behavior.
   - Validate manifest records P16 complete after implementation.

6. Update traceability and manifest.
   - Add P16 coverage to `docs/spec/release-gate.md`, `docs/spec/run-state-governance.md`, and `docs/spec/traceability-matrix.md`.
   - Add `phase_execution.P16` to `docs/spec/manifest.json` with status `complete`, evidence list, checks, requirement mappings, and token accounting.
   - Do not remove P0-P15 evidence.

7. Verify and repair.
   - Run `node scripts/check-pilot-cutover-readiness.mjs`.
   - Run `bash docs/spec/pipeline-p15/checks/p15.sh`.
   - Run `bash docs/spec/pipeline-p16/checks/p16.sh`.
   - Repair only implementation or documentation gaps identified by those external checks.

## Exit Criteria

The independent P16 oracle is:

```bash
bash docs/spec/pipeline-p16/checks/p16.sh
```

It must prove:

- P16 artifacts exist and are non-trivial;
- approval JSON parses and keeps human approvals pending;
- local deployment, cutover, release gate, run-state governance, and traceability docs match the five-domain P16 pilot surface;
- machine-readable readiness checker passes;
- P15 safety gate remains green;
- manifest records P16 as complete.

## Gate

P16 is `gate: human`.

Reason: P16 can prove readiness evidence consistency, but production pilot approval remains human judgment. The pipeline must park after green checks until `docs/spec/pipeline-p16/approvals/P16.approved` exists.

## Rollback

If P16 fails, do not change route exposure or policy. Keep the platform at the P15 technical state and fix the readiness evidence. If a readiness check uncovers a real route-safety regression, quarantine the affected route and rerun the predecessor gate before attempting P16 again.
