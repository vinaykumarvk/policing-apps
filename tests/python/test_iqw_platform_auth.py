from __future__ import annotations

import asyncio
import importlib.util
import json
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
FIXTURE_PATH = ROOT / "docs" / "spec" / "auth-claim-fixtures.json"
ADAPTER_PATH = ROOT / "domains" / "iqw-api" / "src" / "middleware" / "platform_auth.py"
NOW = datetime.fromisoformat("2026-07-01T18:45:00+00:00")


def load_adapter():
    spec = importlib.util.spec_from_file_location("iqw_platform_auth", ADAPTER_PATH)
    if spec is None or spec.loader is None:
        raise AssertionError("missing IQW platform auth adapter")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


platform_auth = load_adapter()


def fixtures() -> dict:
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


def persona(persona_id: str) -> dict:
    for entry in fixtures()["personas"]:
        if entry["id"] == persona_id:
            return deepcopy(entry["claim"])
    raise AssertionError(f"missing persona {persona_id}")


def decision(claim: dict, *, server_verified: bool = True, revoked_session_ids: list[str] | None = None) -> dict:
    return platform_auth.evaluate_iqw_platform_auth(
        claims=claim,
        server_verified=server_verified,
        now=NOW,
        revoked_session_ids=revoked_session_ids or [],
        service_path="/api/v1/iqw/complaints",
        correlation_id="corr-iqw-test",
    )


def test_iqw_platform_auth_allows_verified_claim_and_records_evidence() -> None:
    result = decision(persona("desk-operator"))

    assert result["allowed"] is True
    assert result["reason"] == "ALLOW"
    assert result["evidence"]["gate_evidence_ref"] == "P8-iqw-platform-auth-adapter"
    assert result["evidence"]["claims_snapshot"]["subject_id"] == "user-desk-001"
    assert result["evidence"]["local_auth_required"] is True


def test_iqw_platform_auth_denies_local_bypass_without_server_verified_claim() -> None:
    result = decision(persona("desk-operator"), server_verified=False)

    assert result["allowed"] is False
    assert result["reason"] == "SERVER_VERIFICATION_REQUIRED"
    assert result["evidence"]["outcome"] == "DENY"


def test_iqw_platform_auth_denies_wrong_module_jurisdiction_clearance_stale_claim_and_revocation() -> None:
    assert decision(persona("analyst"))["reason"] == "MODULE_DENIED"

    wrong_jurisdiction = persona("desk-operator")
    wrong_jurisdiction["jurisdiction"]["districts"] = ["Ludhiana"]
    wrong_jurisdiction["jurisdiction"]["police_stations"] = ["Civil Lines"]
    assert decision(wrong_jurisdiction)["reason"] == "JURISDICTION_DENIED"

    wrong_clearance = persona("desk-operator")
    wrong_clearance["clearance"]["level"] = "public"
    assert decision(wrong_clearance)["reason"] == "CLEARANCE_DENIED"

    stale_claim = persona("desk-operator")
    stale_claim["issued_at"] = "2026-07-01T18:00:00Z"
    stale_claim["expires_at"] = "2026-07-01T19:30:00Z"
    assert decision(stale_claim)["reason"] == "CLAIM_STALE"

    revoked_claim = persona("desk-operator")
    revoked = decision(revoked_claim, revoked_session_ids=[revoked_claim["session_id"]])
    assert revoked["allowed"] is False
    assert revoked["reason"] == "PLATFORM_SESSION_REVOKED"


def test_iqw_break_glass_is_audited_and_time_boxed() -> None:
    allowed = platform_auth.evaluate_iqw_platform_auth(
        claims=None,
        server_verified=False,
        now=NOW,
        service_path="/api/v1/iqw/complaints",
        correlation_id="corr-iqw-break-glass",
        break_glass={
            "requested": True,
            "expires_at": "2026-07-01T18:50:00Z",
            "reason": "incident commander approval INC-IQW-001",
        },
    )
    assert allowed["allowed"] is True
    assert allowed["evidence"]["break_glass"]["expires_at"] == "2026-07-01T18:50:00Z"
    assert "INC-IQW-001" in allowed["evidence"]["break_glass"]["reason"]

    expired = platform_auth.evaluate_iqw_platform_auth(
        claims=None,
        server_verified=False,
        now=NOW,
        service_path="/api/v1/iqw/complaints",
        correlation_id="corr-iqw-break-glass-expired",
        break_glass={
            "requested": True,
            "expires_at": "2026-07-01T18:44:00Z",
            "reason": "expired approval",
        },
    )
    assert expired["allowed"] is False
    assert expired["reason"] == "BREAK_GLASS_EXPIRED"


async def app_ok(scope: dict, receive, send) -> None:
    body = json.dumps({"ok": True, "platformAuthOutcome": scope.get("platform_auth", {}).get("outcome", "none")}).encode(
        "utf-8"
    )
    await send({"type": "http.response.start", "status": 200, "headers": [(b"content-type", b"application/json")]})
    await send({"type": "http.response.body", "body": body})


async def empty_receive() -> dict:
    return {"type": "http.request", "body": b"", "more_body": False}


def run_middleware(scope: dict, middleware) -> list[dict]:
    messages: list[dict] = []

    async def send(message: dict) -> None:
        messages.append(message)

    asyncio.run(middleware(scope, empty_receive, send))
    return messages


def status_from(messages: list[dict]) -> int:
    for message in messages:
        if message.get("type") == "http.response.start":
            return int(message["status"])
    raise AssertionError("missing response start")


def body_from(messages: list[dict]) -> dict:
    body = b"".join(message.get("body", b"") for message in messages if message.get("type") == "http.response.body")
    return json.loads(body.decode("utf-8"))


def test_iqw_asgi_middleware_blocks_platform_launch_without_claims_even_with_local_auth_state() -> None:
    middleware = platform_auth.PlatformAuthMiddleware(app_ok, now_provider=lambda: NOW)
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/api/v1/iqw/complaints",
        "headers": [(b"x-platform-launch", b"true")],
        "local_auth_user": {"user_id": "local-domain-user"},
    }

    messages = run_middleware(scope, middleware)

    assert status_from(messages) == 403
    assert body_from(messages)["reason"] == "PLATFORM_CLAIMS_REQUIRED"
    assert scope["platform_auth"]["outcome"] == "DENY"


def test_iqw_asgi_middleware_allows_direct_local_bootstrap_without_platform_headers() -> None:
    middleware = platform_auth.PlatformAuthMiddleware(app_ok, now_provider=lambda: NOW)
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/api/v1/iqw/complaints",
        "headers": [],
        "local_auth_user": {"user_id": "local-domain-user"},
    }

    messages = run_middleware(scope, middleware)

    assert status_from(messages) == 200
    assert body_from(messages)["platformAuthOutcome"] == "none"


def test_iqw_asgi_middleware_allows_verified_platform_claim() -> None:
    middleware = platform_auth.PlatformAuthMiddleware(app_ok, now_provider=lambda: NOW)
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/api/v1/iqw/complaints",
        "headers": [
            (b"x-platform-launch", b"true"),
            (b"x-platform-claims", json.dumps(persona("desk-operator")).encode("utf-8")),
            (b"x-platform-claims-verified", b"true"),
        ],
    }

    messages = run_middleware(scope, middleware)

    assert status_from(messages) == 200
    assert body_from(messages)["platformAuthOutcome"] == "ALLOW"
    assert scope["platform_auth"]["outcome"] == "ALLOW"
