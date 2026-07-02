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

echo "== P12 exit criteria =="
need_file docs/spec/release-gate.md 900
need_file docs/spec/cutover-governance-runbook.md 900
need_file docs/spec/run-state-governance.md 900
need_file docs/spec/traceability-matrix.md 900

grep -Eiq "G-SEC-001|G-SEC-002|G-SEC-003|G-SEC-004|G-OPS-001" docs/spec/release-gate.md docs/spec/traceability-matrix.md && grn "global gates traced" || red "global gates not traced"
grep -Eiq "rollback|active investigation|audit continuity|legal hold|emergency revocation|incident response|access review|stale projection" docs/spec/cutover-governance-runbook.md docs/spec/run-state-governance.md && grn "operations governance covered" || red "operations governance incomplete"
grep -Eiq "P0|P1|P2|P3|P4|P5|P6|P7|P8|P9|P10|P11|P12" docs/spec/traceability-matrix.md && grn "phase traceability covered" || red "phase traceability incomplete"
npm run typecheck >/dev/null 2>&1 && grn "root typecheck" || red "root typecheck failed"
npm --workspace apps/platform-api run test >/dev/null 2>&1 && grn "platform-api tests" || red "platform-api tests failed"
npm --workspace apps/platform-web run test >/dev/null 2>&1 && grn "platform-web tests" || red "platform-web tests failed"
bash scripts/smoke-platform-local.sh >/dev/null 2>&1 && grn "local smoke script" || red "local smoke script failed"

if [ "$fail" -eq 0 ]; then echo "== GREEN: P12 exit criteria met =="; else echo "== RED: P12 not complete =="; fi
exit "$fail"
