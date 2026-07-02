from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Awaitable, Callable, Iterable, MutableMapping, Sequence


CLAIM_SCHEMA_VERSION = "platform.claims.v1"
POLICY_VERSION = "platform.entitlements.v1"
ADAPTER_VERSION = "iqw-platform-auth-adapter.v1"
GATE_EVIDENCE_REF = "P8-iqw-platform-auth-adapter"
MAX_AGE_SECONDS = 15 * 60
CLEARANCE_ORDER = ["public", "restricted", "confidential", "secret"]

IQW_ENTITLEMENT_REQUEST = {
    "module": "iqw",
    "domain": "iqw",
    "permission": "complaint:read",
    "org_id": "mohali-district",
    "unit_id": "desk-mohali",
    "jurisdiction": {
        "country": "IN",
        "state": "PB",
        "district": "SAS Nagar",
        "police_station": "Phase-8",
    },
    "requiredClearance": "restricted",
    "assignment": {"queue_id": "desk-mohali-intake"},
    "purpose": "complaint_intake",
    "requireMfa": True,
}

Message = MutableMapping[str, object]
Scope = MutableMapping[str, object]
Receive = Callable[[], Awaitable[Message]]
Send = Callable[[Message], Awaitable[None]]
ASGIApp = Callable[[Scope, Receive, Send], Awaitable[None]]


class PlatformAuthMiddleware:
    """FastAPI/Starlette-compatible ASGI middleware for IQW platform launches."""

    def __init__(
        self,
        app: ASGIApp,
        *,
        now_provider: Callable[[], datetime] | None = None,
        revoked_session_ids: Iterable[str] | None = None,
        audit_sink: Callable[[dict[str, object]], None] | None = None,
    ) -> None:
        self.app = app
        self.now_provider = now_provider or (lambda: datetime.now(timezone.utc))
        self.revoked_session_ids = set(revoked_session_ids or revoked_sessions_from_env())
        self.audit_sink = audit_sink

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope.get("type") != "http" or not is_platform_launched_scope(scope):
            await self.app(scope, receive, send)
            return

        headers = scope_headers(scope)
        claims, parse_error = parse_claims_header(headers.get("x-platform-claims"))
        decision = evaluate_iqw_platform_auth(
            claims=claims,
            server_verified=is_truthy(headers.get("x-platform-claims-verified")),
            now=self.now_provider(),
            revoked_session_ids=self.revoked_session_ids,
            service_path=str(scope.get("path") or ""),
            correlation_id=headers.get("x-correlation-id") or headers.get("x-request-id") or "iqw-request",
            claims_parse_error=parse_error,
            break_glass={
                "requested": is_truthy(headers.get("x-platform-break-glass")),
                "expires_at": headers.get("x-platform-break-glass-until"),
                "reason": headers.get("x-platform-break-glass-reason"),
            },
        )
        if self.audit_sink:
            self.audit_sink(decision["evidence"])
        scope["platform_auth"] = decision["evidence"]

        if decision["allowed"]:
            await self.app(scope, receive, send)
            return

        payload = json.dumps(
            {
                "error": "PLATFORM_AUTH_DENIED",
                "message": "Platform authorization denied",
                "statusCode": 403,
                "reason": decision["reason"],
                "correlationId": decision["evidence"]["correlation_id"],
            }
        ).encode("utf-8")
        await send(
            {
                "type": "http.response.start",
                "status": 403,
                "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(payload)).encode("ascii"))],
            }
        )
        await send({"type": "http.response.body", "body": payload})


def evaluate_iqw_platform_auth(
    *,
    claims: object | None,
    server_verified: bool,
    now: datetime,
    revoked_session_ids: Iterable[str] | None = None,
    service_path: str = "/api/v1/iqw",
    correlation_id: str = "iqw-request",
    claims_parse_error: str | None = None,
    break_glass: dict[str, object] | None = None,
) -> dict[str, object]:
    now = normalize_dt(now)

    if break_glass and bool(break_glass.get("requested")):
        return evaluate_break_glass(
            now=now,
            service_path=service_path,
            correlation_id=correlation_id,
            expires_at=break_glass.get("expires_at") or os.getenv("IQW_PLATFORM_BREAK_GLASS_UNTIL"),
            reason=break_glass.get("reason") or os.getenv("IQW_PLATFORM_BREAK_GLASS_REASON"),
        )

    if claims_parse_error:
        return deny("CLAIM_MALFORMED", now, service_path, correlation_id, server_verified)
    if claims is None:
        return deny("PLATFORM_CLAIMS_REQUIRED", now, service_path, correlation_id, server_verified)

    valid, reason = validate_claim(claims, now)
    if not valid:
        return deny(reason, now, service_path, correlation_id, server_verified)
    claim = claims
    assert isinstance(claim, dict)

    if str(claim.get("session_id")) in set(revoked_session_ids or revoked_sessions_from_env()):
        return deny("PLATFORM_SESSION_REVOKED", now, service_path, correlation_id, server_verified, claim_snapshot(claim))

    allowed, reason = entitlement_allows(claim, IQW_ENTITLEMENT_REQUEST, server_verified)
    return {
        "allowed": allowed,
        "reason": "ALLOW" if allowed else reason,
        "evidence": evidence(
            now=now,
            service_path=service_path,
            correlation_id=correlation_id,
            outcome="ALLOW" if allowed else "DENY",
            reason="ALLOW" if allowed else reason,
            server_verified=server_verified,
            snapshot=claim_snapshot(claim),
        ),
    }


def evaluate_break_glass(
    *,
    now: datetime,
    service_path: str,
    correlation_id: str,
    expires_at: object,
    reason: object,
) -> dict[str, object]:
    expires = parse_dt(expires_at) if isinstance(expires_at, str) else None
    if expires is None:
        return deny("BREAK_GLASS_NOT_CONFIGURED", now, service_path, correlation_id, False)
    if expires <= now:
        return deny("BREAK_GLASS_EXPIRED", now, service_path, correlation_id, False)
    if not isinstance(reason, str) or not reason.strip():
        return deny("BREAK_GLASS_REASON_REQUIRED", now, service_path, correlation_id, False)

    evidence_value = evidence(
        now=now,
        service_path=service_path,
        correlation_id=correlation_id,
        outcome="ALLOW",
        reason="ALLOW",
        server_verified=False,
    )
    evidence_value["break_glass"] = {"expires_at": isoformat_z(expires), "reason": reason}
    return {"allowed": True, "reason": "ALLOW", "evidence": evidence_value}


def validate_claim(claim: object, now: datetime) -> tuple[bool, str]:
    if not isinstance(claim, dict):
        return False, "CLAIM_MISSING"
    if claim.get("schema_version") != CLAIM_SCHEMA_VERSION:
        return False, "CLAIM_UNSUPPORTED_VERSION"

    required = [
        "claim_version",
        "source_version",
        "subject",
        "issued_at",
        "expires_at",
        "session_id",
        "modules",
        "domain_permissions",
        "org",
        "jurisdiction",
        "clearance",
        "assignment",
        "purpose",
        "mfa",
    ]
    if any(key not in claim for key in required):
        return False, "CLAIM_MALFORMED"

    issued = parse_dt(claim.get("issued_at"))
    expires = parse_dt(claim.get("expires_at"))
    if issued is None or expires is None:
        return False, "CLAIM_MALFORMED"
    if expires <= now:
        return False, "CLAIM_EXPIRED"
    if issued > now or (now - issued).total_seconds() > MAX_AGE_SECONDS:
        return False, "CLAIM_STALE"

    modules = claim.get("modules")
    permissions = claim.get("domain_permissions")
    if not list_has_unique_strings(modules):
        return False, "CLAIM_AMBIGUOUS"
    if not isinstance(permissions, list) or not permissions:
        return False, "CLAIM_MALFORMED"
    domains = []
    for entry in permissions:
        if not isinstance(entry, dict) or not isinstance(entry.get("domain"), str):
            return False, "CLAIM_MALFORMED"
        domains.append(entry["domain"])
        if not list_has_unique_strings(entry.get("permissions")):
            return False, "CLAIM_AMBIGUOUS"
    if len(domains) != len(set(domains)):
        return False, "CLAIM_AMBIGUOUS"

    return True, "OK"


def entitlement_allows(claim: dict[str, object], request: dict[str, object], server_verified: bool) -> tuple[bool, str]:
    if not server_verified:
        return False, "SERVER_VERIFICATION_REQUIRED"
    if request["module"] not in claim.get("modules", []):
        return False, "MODULE_DENIED"

    domain_claim = next(
        (
            entry
            for entry in claim.get("domain_permissions", [])
            if isinstance(entry, dict) and entry.get("domain") == request["domain"]
        ),
        None,
    )
    if not isinstance(domain_claim, dict) or request["permission"] not in domain_claim.get("permissions", []):
        return False, "DOMAIN_DENIED"

    org = claim.get("org")
    if not isinstance(org, dict) or org.get("org_id") != request["org_id"]:
        return False, "ORG_DENIED"
    if request.get("unit_id") and org.get("scope") != "org" and request["unit_id"] not in org.get("unit_ids", []):
        return False, "ORG_DENIED"

    if not jurisdiction_allows(claim.get("jurisdiction"), request["jurisdiction"]):
        return False, "JURISDICTION_DENIED"
    if not clearance_allows(claim.get("clearance"), str(request["requiredClearance"])):
        return False, "CLEARANCE_DENIED"
    if not assignment_allows(claim.get("assignment"), request.get("assignment")):
        return False, "ASSIGNMENT_DENIED"

    purpose = claim.get("purpose")
    if not isinstance(purpose, dict) or request["purpose"] not in purpose.get("allowed", []):
        return False, "PURPOSE_DENIED"
    if request.get("requireMfa") and not mfa_allows(claim.get("mfa")):
        return False, "MFA_DENIED"
    return True, "ALLOW"


def jurisdiction_allows(claim_jurisdiction: object, request_jurisdiction: object) -> bool:
    if not isinstance(claim_jurisdiction, dict) or not isinstance(request_jurisdiction, dict):
        return False
    if claim_jurisdiction.get("country") != request_jurisdiction.get("country"):
        return False
    if claim_jurisdiction.get("state") != request_jurisdiction.get("state"):
        return False
    scope = claim_jurisdiction.get("scope")
    if scope in {"national", "state"}:
        return True
    if scope == "district":
        return request_jurisdiction.get("district") in claim_jurisdiction.get("districts", [])
    return (
        request_jurisdiction.get("district") in claim_jurisdiction.get("districts", [])
        and request_jurisdiction.get("police_station") in claim_jurisdiction.get("police_stations", [])
    )


def clearance_allows(clearance: object, required: str) -> bool:
    if not isinstance(clearance, dict) or clearance.get("level") not in CLEARANCE_ORDER or required not in CLEARANCE_ORDER:
        return False
    return CLEARANCE_ORDER.index(str(clearance["level"])) >= CLEARANCE_ORDER.index(required)


def assignment_allows(claim_assignment: object, request_assignment: object) -> bool:
    if not isinstance(claim_assignment, dict) or not isinstance(request_assignment, dict):
        return False
    if claim_assignment.get("jurisdiction_wide") or claim_assignment.get("domain_wide"):
        return True
    return (
        request_assignment.get("case_id") in claim_assignment.get("case_ids", [])
        or request_assignment.get("queue_id") in claim_assignment.get("queue_ids", [])
        or request_assignment.get("evidence_id") in claim_assignment.get("evidence_ids", [])
    )


def mfa_allows(mfa: object) -> bool:
    return (
        isinstance(mfa, dict)
        and bool(mfa.get("required"))
        and bool(mfa.get("verified"))
        and bool(mfa.get("methods"))
        and bool(mfa.get("verified_at"))
    )


def deny(
    reason: str,
    now: datetime,
    service_path: str,
    correlation_id: str,
    server_verified: bool,
    snapshot: dict[str, object] | None = None,
) -> dict[str, object]:
    return {
        "allowed": False,
        "reason": reason,
        "evidence": evidence(
            now=now,
            service_path=service_path,
            correlation_id=correlation_id,
            outcome="DENY",
            reason=reason,
            server_verified=server_verified,
            snapshot=snapshot,
        ),
    }


def evidence(
    *,
    now: datetime,
    service_path: str,
    correlation_id: str,
    outcome: str,
    reason: str,
    server_verified: bool,
    snapshot: dict[str, object] | None = None,
) -> dict[str, object]:
    value: dict[str, object] = {
        "adapter_version": ADAPTER_VERSION,
        "gate_evidence_ref": GATE_EVIDENCE_REF,
        "policy_version": POLICY_VERSION,
        "service_path": service_path,
        "outcome": outcome,
        "reason": reason,
        "correlation_id": correlation_id,
        "source_version": "iqw-api",
        "projection_version": "not_applicable",
        "redaction_decision": "not_applicable",
        "server_verified": server_verified,
        "local_auth_required": True,
        "audited_at": isoformat_z(now),
    }
    if snapshot:
        value["claims_snapshot"] = snapshot
    return value


def claim_snapshot(claim: dict[str, object]) -> dict[str, object]:
    subject = claim.get("subject") if isinstance(claim.get("subject"), dict) else {}
    return {
        "schema_version": claim.get("schema_version"),
        "claim_version": claim.get("claim_version"),
        "source_version": claim.get("source_version"),
        "subject_id": subject.get("user_id") if isinstance(subject, dict) else None,
        "persona": subject.get("persona") if isinstance(subject, dict) else None,
        "session_id": claim.get("session_id"),
        "modules": list(claim.get("modules", [])) if isinstance(claim.get("modules"), list) else [],
        "domain_permissions": claim.get("domain_permissions", []),
        "org": claim.get("org", {}),
        "jurisdiction": claim.get("jurisdiction", {}),
        "clearance": claim.get("clearance", {}),
        "assignment": claim.get("assignment", {}),
        "purpose": claim.get("purpose", {}),
        "mfa_verified": bool(claim.get("mfa", {}).get("verified")) if isinstance(claim.get("mfa"), dict) else False,
        "expires_at": claim.get("expires_at"),
    }


def is_platform_launched_scope(scope: Scope) -> bool:
    headers = scope_headers(scope)
    return (
        "x-platform-claims" in headers
        or "x-platform-claims-verified" in headers
        or is_truthy(headers.get("x-platform-launch"))
        or is_truthy(headers.get("x-platform-launched"))
        or is_truthy(headers.get("x-platform-route"))
    )


def scope_headers(scope: Scope) -> dict[str, str]:
    raw_headers = scope.get("headers", [])
    headers: dict[str, str] = {}
    if isinstance(raw_headers, Sequence):
        for item in raw_headers:
            if not isinstance(item, tuple) or len(item) != 2:
                continue
            name, value = item
            if isinstance(name, bytes) and isinstance(value, bytes):
                headers[name.decode("latin1").lower()] = value.decode("latin1")
    return headers


def parse_claims_header(raw: str | None) -> tuple[object | None, str | None]:
    if raw is None:
        return None, None
    try:
        return json.loads(raw), None
    except json.JSONDecodeError:
        return None, "x-platform-claims must be valid JSON"


def parse_dt(value: object) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)
    except ValueError:
        return None


def normalize_dt(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def isoformat_z(value: datetime) -> str:
    return normalize_dt(value).isoformat().replace("+00:00", "Z")


def is_truthy(value: str | None) -> bool:
    return bool(value and value.strip().lower() in {"1", "true", "yes", "platform"})


def list_has_unique_strings(value: object) -> bool:
    return isinstance(value, list) and bool(value) and all(isinstance(item, str) and item.strip() for item in value) and len(value) == len(set(value))


def revoked_sessions_from_env() -> list[str]:
    return [item.strip() for item in os.getenv("IQW_PLATFORM_REVOKED_SESSIONS", "").split(",") if item.strip()]
