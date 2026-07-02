#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

COMPOSE_FILE="deploy/docker-compose/policing-platform.yml"
NGINX_FILE="deploy/nginx/policing-platform.local.conf"
BASE_URL="${PLATFORM_PILOT_BASE_URL:-http://127.0.0.1:${POLICING_PLATFORM_PORT:-8088}}"

ok() { printf 'ok   %s\n' "$*"; }
fail() { printf 'RED  %s\n' "$*" >&2; exit 1; }

need_file() {
  local file="$1"
  local min_bytes="${2:-1}"
  [ -s "$file" ] || fail "missing file: $file"
  [ "$(wc -c < "$file")" -ge "$min_bytes" ] || fail "file too small: $file"
  ok "$file"
}

contains() {
  local pattern="$1"
  local file="$2"
  grep -Eiq "$pattern" "$file" || fail "$file missing pattern: $pattern"
  ok "$file contains $pattern"
}

http_code() {
  local path="$1"
  curl -k -sS -o /tmp/platform-smoke-body.json -w "%{http_code}" "${BASE_URL}${path}" || true
}

expect_code() {
  local path="$1"
  local expected="$2"
  local code
  code="$(http_code "$path")"
  [ "$code" = "$expected" ] || fail "GET $path returned $code, expected $expected"
  ok "GET $path -> $code"
}

need_file "$COMPOSE_FILE" 500
need_file "$NGINX_FILE" 300
need_file "e2e/tests/platform-pilot-flow.spec.ts" 300

ruby -ryaml -e "YAML.load_file('$COMPOSE_FILE')" >/dev/null 2>&1 \
  && ok "compose yaml parses" \
  || fail "compose yaml invalid"

contains "platform-web" "$COMPOSE_FILE"
contains "platform-api" "$COMPOSE_FILE"
contains "dopams-api" "$COMPOSE_FILE"
contains "forensic-api" "$COMPOSE_FILE"
contains "social-media-api" "$COMPOSE_FILE"
contains "knowledge-api" "$COMPOSE_FILE"
contains "iqw-api" "$COMPOSE_FILE"
contains "pgvector" "$COMPOSE_FILE"
contains "redis-queue" "$COMPOSE_FILE"
contains "object-storage" "$COMPOSE_FILE"
contains "/domains/dopams" "$NGINX_FILE"
contains "/domains/forensic" "$NGINX_FILE"
contains "/domains/social-media" "$NGINX_FILE"
contains "/domains/knowledge" "$NGINX_FILE"
contains "/domains/iqw" "$NGINX_FILE"
contains "PLATFORM_ROUTE_BLOCKED" "$NGINX_FILE"
contains "Knowledge routes are exposed|knowledge.*routes" "$NGINX_FILE"

contains "proxy_pass[[:space:]]+http://knowledge_api" "$NGINX_FILE"

if ! grep -Eiq "^[[:space:]]{2}knowledge-api:[[:space:]]*$" "$COMPOSE_FILE"; then
  fail "Knowledge service is not active in compose profile"
fi
ok "Knowledge service is active in compose profile"

if curl -k -fsS --max-time 2 "${BASE_URL}/health" >/tmp/platform-smoke-health.json 2>/dev/null; then
  ok "live proxy reachable at $BASE_URL"
  expect_code "/api/v1/platform/health" "200"
  expect_code "/api/v1/platform/apps?limit=100" "200"
  python3 - <<'PY'
import json
from pathlib import Path

body = json.loads(Path("/tmp/platform-smoke-body.json").read_text())
apps = {entry["id"]: entry for entry in body["apps"]}
assert apps["dopams"]["launch_url"] == "/domains/dopams"
assert apps["iqw"]["launch_url"] == "/domains/iqw"
assert apps["forensic"]["state"] == "pilot"
assert apps["forensic"]["platform_claim_gate"]["status"] == "passed"
assert apps["social-media"]["state"] == "pilot"
assert apps["social-media"]["platform_claim_gate"]["status"] == "passed"
assert "launch_url" not in apps["social-media"], "default pilot claim should not launch social-media"
assert apps["knowledge"]["state"] == "pilot"
assert apps["knowledge"]["platform_claim_gate"]["status"] == "passed"
assert "launch_url" not in apps["knowledge"], "default pilot claim should not launch knowledge"
PY
  ok "platform registry exposes default DOPAMS/IQW launch URLs and Forensic/Social Media pilot gate state"
  curl -k -fsS --max-time 2 -H "X-Platform-Smoke-Persona: forensic" \
    "${BASE_URL}/api/v1/platform/apps?limit=100" >/tmp/platform-smoke-forensic-apps.json
  python3 - <<'PY'
import json
from pathlib import Path

body = json.loads(Path("/tmp/platform-smoke-forensic-apps.json").read_text())
apps = {entry["id"]: entry for entry in body["apps"]}
assert apps["forensic"]["launch_url"] == "/domains/forensic"
assert "launch_url" not in apps["social-media"], "forensic claim should not launch social-media"
assert "launch_url" not in apps["knowledge"], "forensic claim should not launch knowledge"
PY
  ok "forensic analyst registry exposes Forensic launch URL"
  curl -k -fsS --max-time 2 -H "X-Platform-Smoke-Persona: analyst" \
    "${BASE_URL}/api/v1/platform/apps?limit=100" >/tmp/platform-smoke-analyst-apps.json
  python3 - <<'PY'
import json
from pathlib import Path

body = json.loads(Path("/tmp/platform-smoke-analyst-apps.json").read_text())
apps = {entry["id"]: entry for entry in body["apps"]}
assert apps["social-media"]["launch_url"] == "/domains/social-media"
assert apps["social-media"]["platform_claim_gate"]["evidence_ref"] == "P14-social-media-platform-auth-adapter"
assert "launch_url" not in apps["knowledge"], "analyst claim should not launch knowledge"
PY
  ok "analyst registry exposes Social Media launch URL"
  curl -k -fsS --max-time 2 -H "X-Platform-Smoke-Persona: knowledge" \
    "${BASE_URL}/api/v1/platform/apps?limit=100" >/tmp/platform-smoke-knowledge-apps.json
  python3 - <<'PY'
import json
from pathlib import Path

body = json.loads(Path("/tmp/platform-smoke-knowledge-apps.json").read_text())
apps = {entry["id"]: entry for entry in body["apps"]}
assert apps["knowledge"]["launch_url"] == "/domains/knowledge"
assert apps["knowledge"]["platform_claim_gate"]["evidence_ref"] == "P15-knowledge-platform-auth-adapter"
assert "launch_url" not in apps["forensic"], "knowledge claim should not launch forensic"
assert "launch_url" not in apps["social-media"], "knowledge claim should not launch social-media"
PY
  ok "knowledge persona registry exposes Knowledge launch URL"
  expect_code "/domains/dopams/health" "200"
  expect_code "/domains/iqw/health" "200"
  expect_code "/domains/forensic/health" "200"
  expect_code "/domains/social-media/health" "200"
  expect_code "/domains/knowledge/health" "200"
else
  ok "live proxy not running; static profile and route-blocking checks completed"
  ok "start with: docker compose -f $COMPOSE_FILE up --wait"
fi
