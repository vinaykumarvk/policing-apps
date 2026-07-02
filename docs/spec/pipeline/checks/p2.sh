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

echo "== P2 exit criteria =="
need_file docs/spec/auth-entitlements-contract.md 800
need_file docs/spec/auth-claim-fixtures.json 500
need_file packages/authz/src/claims.ts 200
need_file packages/authz/src/entitlements.ts 200
need_file packages/authz/src/__tests__/claims.test.ts 200
need_file packages/authz/src/__tests__/entitlements.test.ts 200
need_file tests/python/test_platform_claims.py 200

node -e 'const f=require("./docs/spec/auth-claim-fixtures.json"); const s=JSON.stringify(f).toLowerCase(); ["desk","io","analyst","forensic","supervisor","legal","admin","auditor"].forEach(x=>{if(!s.includes(x)) throw new Error("missing "+x)}); ["module","domain","jurisdiction","clearance","assignment","purpose","mfa","version"].forEach(x=>{if(!s.includes(x)) throw new Error("missing claim "+x)})' >/dev/null 2>&1 && grn "claim fixtures cover personas and dimensions" || red "claim fixtures incomplete"
grep -Eiq "deny|stale|missing|version|backward" docs/spec/auth-entitlements-contract.md && grn "contract documents deny/default compatibility" || red "contract missing deny/default compatibility"
npm --workspace packages/authz run test >/dev/null 2>&1 && grn "authz workspace tests" || red "authz workspace tests failed"
python3 -m pytest tests/python/test_platform_claims.py >/dev/null 2>&1 && grn "python claim tests" || red "python claim tests failed"

if [ "$fail" -eq 0 ]; then echo "== GREEN: P2 exit criteria met =="; else echo "== RED: P2 not complete =="; fi
exit "$fail"

