# Platform Auth Claims and Entitlements Contract

Version: 1.2  
Phase: P2 - Platform Auth Claim and Entitlement Contract (amended post-P16: platform IdP claims source)  
Traceability: R-SEC-001, R-SEC-002

## Amendment History

| Version | Date | Change |
|---------|------|--------|
| 1.0 | P2 | Initial contract: claim shape, deny-by-default rules, entitlement dimensions. |
| 1.1 | 2026-07-02 | Added "Platform IdP Claims Source" section describing the production claims issuer (session login, per-request minting, TOTP MFA) and the decision-evidence ledger implementation status. |
| 1.2 | 2026-07-02 | Documented demo mode (`PLATFORM_DEMO_ALLOW_PASSWORD_ONLY`): password-only login permitted when explicitly enabled; sessions are honestly recorded with `mfa.methods: ["password"]` in claims and ledger evidence. **Demo mode must be disabled (env unset, demo account disabled) before any production pilot or real data.** |

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

## Platform IdP Claims Source (v1.1)

The production claims issuer is the platform API itself (`source: "platform-idp"`), implemented in `apps/platform-api/src/auth/`. It replaces the local-stack synthetic persona injection for all cloud deployments.

**Issuance model:**

- Users authenticate with username + password (scrypt-hashed) + TOTP code (RFC 6238, mandatory). Failed logins lock the username after 5 attempts for 5 minutes.
- A successful login issues an HttpOnly, HMAC-SHA256-signed session cookie (8-hour expiry). The session carries only the user id and session id — never claims.
- Claims are minted **fresh on every request** from the Postgres user store (`platform.platform_user`, `platform.platform_user_entitlement`), so revocation (user disable) takes effect on the next request and claims never outlive the 15-minute staleness window.
- Minted claims set `mfa: { required: true, verified: true, methods: [<session auth method>], verified_at: <mint time> }` — the method is `"totp"` for standard logins. When demo mode (`PLATFORM_DEMO_ALLOW_PASSWORD_ONLY=true`) is explicitly enabled, password-only logins are permitted and honestly recorded as `methods: ["password"]` in every claim and ledger record; demo mode is prohibited outside demo/test deployments.
- `source_version` remains `idp-seed-v1` for compatibility with deployed domain-adapter validators. Rotating it requires a coordinated `expectedSourceVersion` update across platform-api and all domain adapters, and a row in the Amendment History.
- Every minted claim is validated with `validatePlatformClaims` before use; a claim that fails validation is never attached to a request.

**Trust boundary:** the platform-api ingress strips any caller-supplied `X-Platform-Claims` / `X-Platform-Claims-Verified` headers. Claims enter requests exclusively via the server-side session gateway, which is the only component allowed to set `X-Platform-Claims-Verified: true` on this ingress.

**User administration:** create/disable/reset operations are guarded by the `platform` domain permission `user:manage` on the caller's minted claims. Users are created from role templates (`apps/platform-api/src/auth/role-templates.ts`) that pin org, jurisdiction, clearance, assignment, and entitlements; freeform grants are not part of this contract version. TOTP secrets are returned exactly once at creation/reset and stored only for verification.

## Decision Evidence Boundary

P2 defined the claim snapshot fields needed for R-SEC-002: schema version, claim version, source version, subject id, modules, domain permissions, org, jurisdiction, clearance, assignment, purpose, MFA verification state, expiry, and validation reason.

**Implementation status (v1.1):** the platform API persists every allow/deny decision — registry views, entitlement checks, case/evidence projections, and user-administration actions (policy `platform.user_admin.v1`), including admin-route authorization denials — to `platform.authorization_decision_evidence` (Cloud SQL) via `createPgEvidenceStore`. Each record carries the SHA-256 integrity hash from `@policing-platform/audit-ledger`. Admins with `user:manage` may read recent entries at `GET /api/v1/platform/admin/decision-evidence`. A ledger write failure never blocks the request path but emits a `decision-evidence-write-failed` alert log line for operational alerting.

## Domain-local Auth

Platform authorization is additive until adapters are complete. Domain-local auth must not be removed or weakened by this contract. During transition, a request must satisfy both the domain-local guard and the platform claim guard for active platform-routed access.
