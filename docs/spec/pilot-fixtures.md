# P4 Pilot Fixture Contract

Version: 1.0  
Phase: P4 - Pilot Users, Cases, Evidence, and Classification Fixtures  
Traceability: P2, P3, R-SEC-001, R-SEC-002, R-DATA-001

## Purpose

The P4 fixtures provide a synthetic pilot data set for exercising the platform control plane before any production pilot data is connected. They cover DOPAMS and IQW flows, central case and evidence projections, field redaction decisions, legal hold behavior, stale projection denial, entitlement revocation, wrong module denial, and wrong jurisdiction denial.

These fixtures are not seed data for production. They are contract fixtures for local and CI tests in TypeScript and Python. The JSON files intentionally use plain objects, arrays, ISO-8601 timestamps, and stable string IDs so both runtimes can parse them without code generation.

## Synthetic Data Safeguards

- `synthetic_data` is set to `true` in every fixture file.
- User records reference only synthetic persona IDs from `docs/spec/auth-claim-fixtures.json`.
- No fixture includes real officer names, complainant names, suspect names, addresses, phone numbers, emails, document numbers, storage URIs, credentials, tokens, or active case data.
- Case and evidence IDs use stable synthetic identifiers such as `CASE-DOPAMS-001`, `CASE-IQW-001`, and `EVID-DOPAMS-001`.
- Narrative fields are deliberately generic and contain no allegation details that could map to an operational matter.
- Central evidence fixtures do not include `storage_uri`; tests verify that storage-location exposure is denied.

## Files

`fixtures/platform/users.json` defines pilot personas and maps each one to a P2 claim fixture. The records describe intended pilot use, allowed modules, and the control-plane scenarios that use the persona.

`fixtures/platform/cases.json` defines one linked DOPAMS plus IQW pilot case pair. The DOPAMS record represents the operational case projection. The IQW record represents the intake/workflow projection linked to the same synthetic pilot matter. Field classification metadata documents which fields must be redacted from lower-clearance reads.

`fixtures/platform/evidence.json` defines central evidence metadata for the pilot case pair. The primary DOPAMS evidence record carries an active legal hold variant. The IQW attachment record exercises a lower classification profile. Neither record exposes a storage URI.

`fixtures/platform/denials.json` is a decision-scenario catalog. Despite the filename, it includes both allow and deny outcomes so one file can prove the whole control-plane matrix. Each scenario includes the claim persona, optional claim mutation, ABAC request, evaluator options, and expected authorization result.

## Required Scenario Coverage

| Scenario | Expected result | Rule exercised |
|---|---:|---|
| `allow_dopams_case_read` | allow | Complete IO claim, DOPAMS module, jurisdiction, assignment, clearance, MFA, and case redaction evidence. |
| `allow_iqw_case_redacted` | allow | Desk operator IQW read with confidential fields redacted from a restricted summary. |
| `allow_legal_hold_evidence_review` | allow | Legal reviewer access to active legal hold evidence for `legal_review` purpose. |
| `deny_wrong_module_admin_to_dopams` | deny | Platform admin module does not imply DOPAMS operational data access. |
| `deny_wrong_jurisdiction` | deny | Jurisdiction mismatch is denied through entitlement inputs. |
| `deny_stale_projection` | deny | Stale `projected_at` blocks reads before returning case data. |
| `deny_legal_hold_investigation` | deny | Ordinary investigation purpose cannot read active legal hold evidence. |
| `deny_storage_uri_redaction` | deny | Central evidence API must not expose `storage_uri` by default. |
| `deny_revocation_incompatible_claim_source` | deny | Revoked or incompatible claim source version denies by default. |

## Test Contract

The required P4 tests are:

- `packages/authz/src/__tests__/pilot-personas.test.ts`
- `apps/platform-api/src/__tests__/fixtures.test.ts`

The tests must parse every JSON fixture, verify the synthetic safeguards, evaluate allow and denial scenarios with `evaluateAbac`, and assert that denial scenarios map to explicit ABAC or entitlement policy inputs. Fixture loading must not require production credentials, live services, or network access.
