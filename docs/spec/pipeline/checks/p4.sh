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

echo "== P4 exit criteria =="
need_file docs/spec/pilot-fixtures.md 700
need_file fixtures/platform/users.json 300
need_file fixtures/platform/cases.json 300
need_file fixtures/platform/evidence.json 300
need_file fixtures/platform/denials.json 300
need_file packages/authz/src/__tests__/pilot-personas.test.ts 200
need_file apps/platform-api/src/__tests__/fixtures.test.ts 200

for f in fixtures/platform/users.json fixtures/platform/cases.json fixtures/platform/evidence.json fixtures/platform/denials.json; do
  node -e "JSON.parse(require('fs').readFileSync('$f','utf8'))" >/dev/null 2>&1 && grn "$f parses" || red "$f invalid JSON"
done
node -e 'const fs=require("fs"); const s=["users","cases","evidence","denials"].map(n=>fs.readFileSync(`fixtures/platform/${n}.json`,"utf8")).join("\n").toLowerCase(); ["deny","redact","legal","stale","revocation","jurisdiction"].forEach(x=>{if(!s.includes(x)) throw new Error("missing "+x)})' >/dev/null 2>&1 && grn "fixtures cover denial/redaction scenarios" || red "fixtures missing denial/redaction scenarios"
npm --workspace packages/authz run test >/dev/null 2>&1 && grn "pilot persona tests" || red "pilot persona tests failed"
npm --workspace apps/platform-api run test >/dev/null 2>&1 && grn "platform fixture tests" || red "platform fixture tests failed"

if [ "$fail" -eq 0 ]; then echo "== GREEN: P4 exit criteria met =="; else echo "== RED: P4 not complete =="; fi
exit "$fail"

