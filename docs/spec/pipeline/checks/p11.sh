#!/usr/bin/env bash
set -uo pipefail

ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT" || exit 2

fail=0
red() { echo "  RED  $*"; fail=1; }
grn() { echo "  ok   $*"; }
need_file() {
  if [ -s "$1" ] && [ "$(wc -c < "$1")" -ge "${2:-1}" ]; then grn "$1"; else red "missing or too small: $1"; fi
}

echo "== P11 exit criteria =="
need_file deploy/docker-compose/policing-platform.yml 500
need_file deploy/nginx/policing-platform.local.conf 300
need_file scripts/smoke-platform-local.sh 300
need_file e2e/tests/platform-pilot-flow.spec.ts 300

ruby -ryaml -e 'YAML.load_file("deploy/docker-compose/policing-platform.yml")' >/dev/null 2>&1 && grn "compose yaml parses" || red "compose yaml invalid"
grep -Eiq "platform-web|platform-api|dopams|iqw|postgres|pgvector|redis|object" deploy/docker-compose/policing-platform.yml && grn "compose includes required services" || red "compose missing required services"
grep -Eiq "social|forensic|knowledge|blocked|planned|return 404|deny" deploy/nginx/policing-platform.local.conf e2e/tests/platform-pilot-flow.spec.ts && grn "blocked non-pilot route handling covered" || red "blocked non-pilot route handling missing"
bash scripts/smoke-platform-local.sh >/dev/null 2>&1 && grn "local smoke script" || red "local smoke script failed"

if [ "$fail" -eq 0 ]; then echo "== GREEN: P11 exit criteria met =="; else echo "== RED: P11 not complete =="; fi
exit "$fail"

