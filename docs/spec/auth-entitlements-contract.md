# Platform Auth Claims and Entitlements Contract

Version: 1.0  
Phase: P2 - Platform Auth Claim and Entitlement Contract  
Traceability: R-SEC-001, R-SEC-002

## Purpose

This contract defines the canonical platform claim payload and the first entitlement helper behavior used by platform API, future domain adapters, and cross-runtime tests. It is additive to existing domain-local authorization. Until a domain adapter is ready, local domain auth remains authoritative for that domain and platform auth may only narrow access.

The platform shell may use entitlement results to hide or label modules, but UI visibility is not an authorization boundary. Every protected API path must re-evaluate platform claims server-side before returning data, launching a domain route, or forwarding a user context to a bounded service.

## Canonical Claim Shape

The current claim schema version is `platform.claims.v1`. Versioned fixtures are stored in `docs/spec/auth-claim-fixtures.json` and are shared by TypeScript and Python tests.

Each platform claim must include:

- `schema_version`: exact supported schema identifier.
- `claim_version`: integer version for the claim document.
- `source` and `source_version`: identity or entitlement source metadata.
- `subject`: stable user id, persona, tenant id, org id, and display label.
- `issued_at` and `expires_at`: ISO-8601 timestamps.
- `session_id`: opaque session identifier.
- `modules`: modules the subject may request, such as `dopams`, `iqw`, `forensic`, `social_media`, `knowledge`, or `platform_admin`.
- `domain_permissions`: per-domain permission strings. A platform admin permission does not imply operational case, evidence, or knowledge access.
- `org`: tenant, org, unit ids, and scope.
- `jurisdiction`: country, state, districts, police stations, and scope.
- `clearance`: clearance level and optional compartments.
- `assignment`: assigned case ids, queue ids, evidence ids, and explicit wide-scope flags.
- `purpose`: allowed access purposes.
- `mfa`: whether MFA is required, whether it was verified, method names, and verification timestamp.

## Deny-by-default Rules

The entitlement helper must deny access when a claim is missing, malformed, expired, stale, incompatible, ambiguous, or unsupported. Staleness is evaluated from `issued_at` using the verifier's configured maximum age. Compatibility is evaluated from `schema_version` and, where configured, `source_version`.

Ambiguous claims are denied. Examples include duplicate module names, duplicate domain permission entries for the same domain, invalid timestamps, empty required dimensions, or request contexts that omit the module, domain, permission, purpose, required clearance, or server-side verification flag.

MFA is explicit. If the request requires MFA, the claim must show `mfa.required: true`, `mfa.verified: true`, at least one method, and a verification timestamp. Missing MFA state denies the request.

## Entitlement Decision Inputs

Server-side entitlement checks must evaluate all of these dimensions:

- module requested;
- domain requested;
- domain permission requested;
- org and unit context;
- jurisdiction context;
- minimum required clearance;
- case, queue, or evidence assignment where applicable;
- access purpose;
- MFA requirement;
- claim schema version, source version, issue time, and expiry;
- `serverVerified`, which must be `true` only after the API or adapter has verified the claim signature/session outside the UI.

The TypeScript helper returns `allowed: false` unless every applicable dimension matches. A positive module match alone is never enough.

## Backward Compatibility

Version `platform.claims.v1` is the only currently supported schema. Future versions must be introduced by adding a new parser and keeping fixtures for the previous version until all adapters declare support. A newer or unknown schema version denies by default until the server explicitly opts into it.

Backward-compatible additions may add optional fields only when omission preserves current deny-by-default behavior. Existing fields cannot be weakened, renamed, or repurposed without a new schema version.

## Personas Covered by Fixtures

The seed fixtures cover these synthetic personas:

- desk operator;
- IO;
- analyst;
- forensic analyst;
- supervisor;
- legal reviewer;
- admin;
- auditor.

These personas intentionally separate platform administration from operational data access. For example, the admin persona can manage platform registry metadata but cannot read a DOPAMS case unless a separate domain permission, jurisdiction, purpose, assignment, clearance, and MFA state are present.

## Decision Evidence Boundary

P2 does not implement the immutable decision ledger from P3, but it defines the claim snapshot fields needed for R-SEC-002: schema version, claim version, source version, subject id, modules, domain permissions, org, jurisdiction, clearance, assignment, purpose, MFA verification state, expiry, and validation reason. Later decision evidence must persist the snapshot with policy version, service path, outcome, correlation id, source/projection version, and redaction decision.

## Domain-local Auth

Platform authorization is additive until adapters are complete. Domain-local auth must not be removed or weakened by this contract. During transition, a request must satisfy both the domain-local guard and the platform claim guard for active platform-routed access.
