from __future__ import annotations

import json
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
FIXTURE_PATH = ROOT / "docs" / "spec" / "auth-claim-fixtures.json"
NOW = datetime.fromisoformat("2026-07-01T18:45:00+00:00")
CLAIM_SCHEMA_VERSION = "platform.claims.v1"
MAX_AGE_SECONDS = 15 * 60
CLEARANCE_ORDER = ["public", "restricted", "confidential", "secret"]


def load_fixtures() -> dict:
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


def persona(fixtures: dict, persona_id: str) -> dict:
    for entry in fixtures["personas"]:
        if entry["id"] == persona_id:
            return entry["claim"]
    raise AssertionError(f"missing persona fixture {persona_id}")


def parse_dt(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)


def validate_claim(claim: dict, now: datetime = NOW) -> tuple[bool, str]:
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

    issued = parse_dt(claim["issued_at"])
    expires = parse_dt(claim["expires_at"])
    if expires <= now:
        return False, "CLAIM_EXPIRED"
    if issued > now or (now - issued).total_seconds() > MAX_AGE_SECONDS:
        return False, "CLAIM_STALE"

    domains = [entry["domain"] for entry in claim["domain_permissions"]]
    if len(domains) != len(set(domains)):
        return False, "CLAIM_AMBIGUOUS"

    return True, "OK"


def entitlement_allows(claim: dict, request: dict) -> bool:
    valid, _reason = validate_claim(claim)
    if not valid or not request.get("serverVerified"):
        return False
    if request["module"] not in claim["modules"]:
        return False
    domain_claim = next((entry for entry in claim["domain_permissions"] if entry["domain"] == request["domain"]), None)
    if domain_claim is None or request["permission"] not in domain_claim["permissions"]:
        return False
    if claim["org"]["org_id"] != request["org_id"]:
        return False
    if request.get("unit_id") and claim["org"]["scope"] != "org" and request["unit_id"] not in claim["org"]["unit_ids"]:
        return False
    if claim["jurisdiction"]["country"] != request["jurisdiction"]["country"]:
        return False
    if claim["jurisdiction"]["state"] != request["jurisdiction"]["state"]:
        return False
    if claim["jurisdiction"]["scope"] == "district":
        if request["jurisdiction"].get("district") not in claim["jurisdiction"]["districts"]:
            return False
    if claim["jurisdiction"]["scope"] == "station":
        if request["jurisdiction"].get("police_station") not in claim["jurisdiction"]["police_stations"]:
            return False
    if CLEARANCE_ORDER.index(claim["clearance"]["level"]) < CLEARANCE_ORDER.index(request["requiredClearance"]):
        return False
    assignment = request["assignment"]
    assigned = (
        claim["assignment"]["jurisdiction_wide"]
        or claim["assignment"]["domain_wide"]
        or assignment.get("case_id") in claim["assignment"]["case_ids"]
        or assignment.get("queue_id") in claim["assignment"]["queue_ids"]
        or assignment.get("evidence_id") in claim["assignment"]["evidence_ids"]
    )
    if not assigned:
        return False
    if request["purpose"] not in claim["purpose"]["allowed"]:
        return False
    if request["requireMfa"]:
        mfa = claim["mfa"]
        return bool(mfa["required"] and mfa["verified"] and mfa["methods"] and mfa["verified_at"])
    return True


def dopams_case_read_request(**overrides: object) -> dict:
    request = {
        "module": "dopams",
        "domain": "dopams",
        "permission": "case:read",
        "org_id": "mohali-district",
        "unit_id": "narcotics-cell-mohali",
        "jurisdiction": {
            "country": "IN",
            "state": "PB",
            "district": "SAS Nagar",
            "police_station": "Phase-8",
        },
        "requiredClearance": "confidential",
        "assignment": {"case_id": "CASE-DOPAMS-001"},
        "purpose": "investigation",
        "requireMfa": True,
        "serverVerified": True,
    }
    request.update(overrides)
    return request


def test_fixtures_cover_required_personas_and_dimensions() -> None:
    fixtures = load_fixtures()
    ids = {entry["id"] for entry in fixtures["personas"]}
    assert ids == {
        "desk-operator",
        "io",
        "analyst",
        "forensic-analyst",
        "supervisor",
        "legal-reviewer",
        "admin",
        "auditor",
    }

    for entry in fixtures["personas"]:
        claim = entry["claim"]
        assert claim["schema_version"] == CLAIM_SCHEMA_VERSION
        assert validate_claim(claim) == (True, "OK")
        assert claim["modules"]
        assert claim["domain_permissions"]
        assert claim["org"]["org_id"]
        assert claim["jurisdiction"]["state"]
        assert claim["clearance"]["level"] in CLEARANCE_ORDER
        assert "assignment" in claim
        assert claim["purpose"]["allowed"]
        assert "mfa" in claim
        assert "claim_version" in claim
        assert "expires_at" in claim


def test_python_entitlement_semantics_match_fixture_contract() -> None:
    fixtures = load_fixtures()

    assert entitlement_allows(persona(fixtures, "io"), dopams_case_read_request())
    assert not entitlement_allows(persona(fixtures, "desk-operator"), dopams_case_read_request())
    assert not entitlement_allows(persona(fixtures, "admin"), dopams_case_read_request())
    assert not entitlement_allows(
        persona(fixtures, "io"),
        dopams_case_read_request(serverVerified=False),
    )
    assert not entitlement_allows(
        persona(fixtures, "io"),
        dopams_case_read_request(assignment={"case_id": "CASE-DOPAMS-999"}),
    )
    assert not entitlement_allows(
        persona(fixtures, "io"),
        dopams_case_read_request(purpose="audit"),
    )


def test_negative_claims_deny_by_default() -> None:
    fixtures = load_fixtures()
    io_claim = persona(fixtures, "io")

    expired = deepcopy(io_claim)
    expired["expires_at"] = "2026-07-01T18:31:00Z"
    assert validate_claim(expired) == (False, "CLAIM_EXPIRED")

    unsupported = deepcopy(io_claim)
    unsupported["schema_version"] = "platform.claims.v99"
    assert validate_claim(unsupported) == (False, "CLAIM_UNSUPPORTED_VERSION")

    ambiguous = deepcopy(io_claim)
    ambiguous["domain_permissions"] = [
        {"domain": "dopams", "permissions": ["case:read"]},
        {"domain": "dopams", "permissions": ["case:update"]},
    ]
    assert validate_claim(ambiguous) == (False, "CLAIM_AMBIGUOUS")

    no_mfa = deepcopy(io_claim)
    no_mfa["mfa"] = {"required": True, "verified": False, "methods": [], "verified_at": None}
    assert not entitlement_allows(no_mfa, dopams_case_read_request())
