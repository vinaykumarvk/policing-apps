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

echo "== P8 exit criteria =="
need_file apps/dopams-api/src/middleware/platform-auth.ts 300
need_file docs/spec/iqw-platform-auth-adapter.md 500
need_file domains/iqw-api/src/middleware/platform_auth.py 300
need_file apps/dopams-api/src/__tests__/platform-auth.test.ts 300
need_file tests/python/test_iqw_platform_auth.py 300

grep -Eiq "claim|jurisdiction|clearance|revocation|stale|deny" apps/dopams-api/src/__tests__/platform-auth.test.ts && grn "DOPAMS negative auth cases tested" || red "DOPAMS negative auth cases missing"
grep -Eiq "claim|jurisdiction|clearance|revocation|stale|deny" tests/python/test_iqw_platform_auth.py && grn "IQW negative auth cases tested" || red "IQW negative auth cases missing"
grep -Eiq "break-glass|bootstrap|audit|time-box|bypass" docs/spec/iqw-platform-auth-adapter.md && grn "IQW adapter documents break-glass/bypass handling" || red "IQW adapter missing break-glass/bypass handling"
npm --workspace apps/dopams-api run test >/dev/null 2>&1 && grn "DOPAMS auth tests" || red "DOPAMS tests failed"
python3 -m pytest tests/python/test_iqw_platform_auth.py >/dev/null 2>&1 && grn "IQW auth tests" || red "IQW auth tests failed"

if [ "$fail" -eq 0 ]; then echo "== GREEN: P8 exit criteria met =="; else echo "== RED: P8 not complete =="; fi
exit "$fail"

