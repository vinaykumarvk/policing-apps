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

echo "== P3 exit criteria =="
need_file docs/spec/access-control-threat-model.md 800
need_file docs/spec/data-classification-policy.md 800
need_file docs/spec/authorization-decision-evidence.md 800
need_file packages/authz/src/abac.ts 300
need_file packages/audit-ledger/src/decision-evidence.ts 300
need_file packages/authz/src/__tests__/abac.negative.test.ts 300
need_file packages/audit-ledger/src/__tests__/decision-evidence.test.ts 300

grep -Eiq "platform_case|platform_evidence|redaction|classification|storage_uri" docs/spec/data-classification-policy.md && grn "classification policy covers case/evidence/redaction" || red "classification policy incomplete"
grep -Eiq "claims snapshot|policy version|projection version|redaction decision|correlation" docs/spec/authorization-decision-evidence.md && grn "decision evidence fields documented" || red "decision evidence fields missing"
grep -Eiq "deny|jurisdiction|legal hold|stale|retrieval" docs/spec/access-control-threat-model.md && grn "threat model covers core denial risks" || red "threat model incomplete"
npm --workspace packages/authz run test >/dev/null 2>&1 && grn "authz tests" || red "authz tests failed"
npm --workspace packages/audit-ledger run test >/dev/null 2>&1 && grn "audit-ledger tests" || red "audit-ledger tests failed"

if [ "$fail" -eq 0 ]; then echo "== GREEN: P3 exit criteria met =="; else echo "== RED: P3 not complete =="; fi
exit "$fail"

