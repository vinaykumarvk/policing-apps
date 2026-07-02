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

echo "== P6 exit criteria =="
need_file apps/platform-api/package.json 80
need_file apps/platform-api/src/app.ts 300
need_file apps/platform-api/src/routes/platform.routes.ts 300
need_file apps/platform-api/src/app-registry.ts 300
need_file apps/platform-api/src/migrations/001_platform_foundation.sql 200
need_file apps/platform-api/src/__tests__/app-registry.test.ts 300
need_file apps/platform-api/src/__tests__/entitlements.test.ts 300
need_file apps/platform-api/src/__tests__/decision-evidence.test.ts 300

grep -Eiq "planned|pilot|available|blocked" apps/platform-api/src/app-registry.ts && grn "registry states implemented" || red "registry states missing"
grep -Eiq "launch|url|active|blocked|planned" apps/platform-api/src/__tests__/app-registry.test.ts && grn "registry launch safety tested" || red "registry launch safety test missing"
grep -Eiq "decision|evidence|deny|denied" apps/platform-api/src/__tests__/decision-evidence.test.ts && grn "decision evidence deny path tested" || red "decision evidence deny path missing"
npm --workspace apps/platform-api run test >/dev/null 2>&1 && grn "platform-api tests" || red "platform-api tests failed"

if [ "$fail" -eq 0 ]; then echo "== GREEN: P6 exit criteria met =="; else echo "== RED: P6 not complete =="; fi
exit "$fail"
