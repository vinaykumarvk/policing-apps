# IQW Platform Auth Adapter

Phase: P8 - Pilot Domain Auth Adapters  
Adapter: `domains/iqw-api/src/middleware/platform_auth.py`  
Gate evidence: `P8-iqw-platform-auth-adapter`

## Placement

IQW uses an in-service FastAPI-compatible ASGI middleware. The middleware activates only for platform-launched requests, identified by `x-platform-launch`, `x-platform-launched`, `x-platform-route`, `x-platform-claims`, or `x-platform-claims-verified` headers. Direct IQW local/domain authentication remains available as a bootstrap path, but it is not accepted as platform authorization evidence.

For a platform-launched route, local/domain auth is additive only. A locally authenticated user cannot bypass the platform decision. The middleware denies the request before the IQW handler runs unless the platform claim is present, server verified, fresh, unrevoked, and entitled for the IQW pilot launch context.

## Pilot Entitlement Context

The P8 pilot launch context is fixed to the IQW complaint intake route:

- module: `iqw`
- domain: `iqw`
- permission: `complaint:read`
- organization: `mohali-district`
- unit: `desk-mohali`
- jurisdiction: `IN/PB/SAS Nagar/Phase-8`
- minimum clearance: `restricted`
- assignment: queue `desk-mohali-intake`
- purpose: `complaint_intake`
- MFA: required

This mirrors the platform app registry launch entitlement request. The adapter re-evaluates the same claim server-side instead of trusting UI visibility or a prior client decision.

## Deny Behavior

The adapter denies by default when any of the following is true:

- claim is missing, malformed, expired, stale, ambiguous, or unsupported;
- `x-platform-claims-verified` is absent or false;
- module is not `iqw`;
- domain permission does not include `iqw:complaint:read`;
- org, unit, jurisdiction, clearance, assignment, purpose, or MFA does not satisfy the pilot request;
- the platform session id appears in `IQW_PLATFORM_REVOKED_SESSIONS`;
- platform launch headers are present but no platform decision evidence can be built.

The negative tests in `tests/python/test_iqw_platform_auth.py` cover wrong module, wrong jurisdiction, wrong clearance, stale claim, revocation, and local-auth bypass attempts.

## Audit Evidence

Every platform-launched allow or deny produces a `platform_auth` evidence object on the ASGI scope. It includes adapter version, policy version, claim snapshot when available, service path, outcome, reason, correlation id, source version, redaction decision, server verification state, and the `P8-iqw-platform-auth-adapter` gate reference.

Deployments may pass an `audit_sink` callable to persist the evidence to the platform decision ledger when the ledger is wired. The default middleware does not log claim payloads, session ids, tokens, or PII values.

## Bootstrap And Break-Glass

Direct IQW local/domain auth is a bootstrap path for non-platform routes only. It must not be routed through the platform shell as an active platform module.

Break-glass is explicit and time-boxed. A platform-launched request may use `x-platform-break-glass: true` only when `x-platform-break-glass-until` or `IQW_PLATFORM_BREAK_GLASS_UNTIL` is a future ISO-8601 timestamp and a non-empty reason is supplied by header or `IQW_PLATFORM_BREAK_GLASS_REASON`. Expired or unconfigured break-glass requests deny. Allowed break-glass requests attach audit evidence with expiry and reason for review.

## Registry Gate

The platform app registry may mark IQW as `pilot` only when this adapter and `tests/python/test_iqw_platform_auth.py` pass as part of `docs/spec/pipeline/checks/p8.sh`. Social Media, Forensic, and Knowledge remain planned or blocked until their own server-side platform-claim gates pass.
